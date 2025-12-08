import { memo, useCallback, useEffect, useRef, useState } from 'react';
import clamp from 'lodash/clamp';
import throttle from 'lodash/throttle';
import type WFPlayer from 'wfplayer';
import WFPlayerCore from 'wfplayer';
import { SAMPLE_AUDIO_URL } from './constants';
import type { RenderState, SubtitleEditorShared } from './types';
import Metronome from './Metronome';
import Timeline from './Timeline';

const WaveformCanvas = memo(
  ({
    player,
    setWaveform,
    setRender,
  }: Pick<SubtitleEditorShared, 'player' | 'setWaveform'> & { setRender: (render: RenderState) => void }) => {
    const waveformRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!player || !waveformRef.current) return;
      WFPlayerCore.instances.forEach((item) => item.destroy());
      const waveform = new WFPlayerCore({
        scrollable: true,
        useWorker: false,
        duration: 10,
        padding: 2,
        wave: true,
        pixelRatio: 2,
        container: waveformRef.current,
        mediaElement: player,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        waveColor: 'rgba(255, 255, 255, 0.2)',
        progressColor: 'rgba(255, 255, 255, 0.5)',
        gridColor: 'rgba(255, 255, 255, 0.05)',
        rulerColor: 'rgba(255, 255, 255, 0.5)',
        paddingColor: 'rgba(0, 0, 0, 0)',
      });

      setWaveform(waveform as WFPlayer);
      waveform.on('update', (config: any) => {
        setRender({
          padding: config.padding,
          duration: config.duration,
          gridGap: config.gridGap,
          gridNum: config.gridNum,
          beginTime: config.beginTime,
        });
      });
      waveform.load(SAMPLE_AUDIO_URL);

      return () => {
        waveform.destroy();
        setWaveform(null);
      };
    }, [player, setRender, setWaveform]);

    return <div ref={waveformRef} className="absolute inset-0 z-0" />;
  },
);

const Grab = ({ player, waveform }: Pick<SubtitleEditorShared, 'player' | 'waveform'>) => {
  const [grabbing, setGrabbing] = useState(false);
  const [grabStartX, setGrabStartX] = useState(0);
  const [grabStartTime, setGrabStartTime] = useState(0);

  const onGrabDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !player) return;
      setGrabStartX(event.pageX);
      setGrabStartTime(player.currentTime);
      setGrabbing(true);
    },
    [player],
  );

  const onGrabMove = useCallback(
    (event: MouseEvent) => {
      if (!grabbing || !player || !waveform) return;
      const currentTime = clamp(
        grabStartTime - ((event.pageX - grabStartX) / document.body.clientWidth) * 10,
        0,
        player.duration || 0,
      );
      player.currentTime = currentTime;
      waveform.seek(currentTime);
    },
    [grabbing, grabStartX, grabStartTime, player, waveform],
  );

  const onGrabUp = useCallback(() => {
    setGrabbing(false);
    setGrabStartX(0);
    setGrabStartTime(0);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', onGrabUp);
    document.addEventListener('mousemove', onGrabMove);
    return () => {
      document.removeEventListener('mouseup', onGrabUp);
      document.removeEventListener('mousemove', onGrabMove);
    };
  }, [onGrabMove, onGrabUp]);

  return (
    <div
      className={`relative z-10 h-8 cursor-grab rounded-md border border-sky-500/40 bg-sky-600/20 ${grabbing ? 'cursor-grabbing' : ''}`}
      onMouseDown={onGrabDown}
    />
  );
};

const Progress = ({
  player,
  waveform,
  currentTime,
  subtitle,
}: Pick<SubtitleEditorShared, 'player' | 'waveform' | 'currentTime' | 'subtitle'>) => {
  const [grabbing, setGrabbing] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const frameCacheRef = useRef<Map<number, string>>(new Map()); // Cache for extracted frames

  // Initialize canvas and preview video for frame extraction
  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    if (!previewVideoRef.current && player) {
      const previewVideo = document.createElement('video');
      previewVideo.src = player.src;
      previewVideo.crossOrigin = 'anonymous';
      previewVideo.muted = true;
      previewVideo.preload = 'auto'; // Preload video for faster seeking
      previewVideo.style.display = 'none';
      previewVideoRef.current = previewVideo;
    }
  }, [player]);

  // Unified mouse down handler - works from anywhere on the progress bar
  const onProgressMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!player || !waveform || event.button !== 0) return;

      // Immediately seek to clicked position
      const rect = event.currentTarget.getBoundingClientRect();
      const progress = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const current = progress * (player.duration || 0);
      player.currentTime = current;
      waveform.seek(current);

      // Start dragging
      setGrabbing(true);
    },
    [player, waveform],
  );

  const onGrabMove = useCallback(
    (event: MouseEvent) => {
      if (!grabbing || !player) return;
      const progress = clamp(event.pageX / document.body.clientWidth, 0, 1);
      player.currentTime = progress * (player.duration || 0);
    },
    [grabbing, player],
  );

  const onDocumentMouseUp = useCallback(() => {
    if (!grabbing) return;
    setGrabbing(false);
    if (waveform && player) {
      waveform.seek(player.currentTime);
    }
  }, [grabbing, waveform, player]);

  // Extract video frame at specific time using separate video element
  const extractFrame = useCallback(
    (hoverTime: number) => {
      if (!previewVideoRef.current || !canvasRef.current) return;

      // Round to nearest 0.5 second for better cache hit rate
      const cacheKey = Math.round(hoverTime * 2) / 2;

      // Check cache first
      const cachedFrame = frameCacheRef.current.get(cacheKey);
      if (cachedFrame) {
        setPreviewImage(cachedFrame);
        return;
      }

      const previewVideo = previewVideoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for better performance
      if (!ctx) return;

      // Seek preview video to hover position
      previewVideo.currentTime = hoverTime;

      // Use requestVideoFrameCallback if available for faster frame extraction
      const extractFrameData = () => {
        // Set smaller canvas size for faster rendering (120px instead of 160px)
        canvas.width = 120;
        canvas.height = (120 * (previewVideo.videoHeight || 0)) / (previewVideo.videoWidth || 1) || 68;

        // Draw frame at hover position
        ctx.drawImage(previewVideo, 0, 0, canvas.width, canvas.height);

        // Convert to data URL with lower quality for faster encoding (0.5 instead of 0.7)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        setPreviewImage(dataUrl);

        // Cache the frame (limit cache size to 50 frames)
        if (frameCacheRef.current.size >= 50) {
          const firstKey = frameCacheRef.current.keys().next().value;
          if (firstKey !== undefined) {
            frameCacheRef.current.delete(firstKey);
          }
        }
        frameCacheRef.current.set(cacheKey, dataUrl);
      };

      // Try to use requestVideoFrameCallback for better performance
      if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
        (previewVideo as any).requestVideoFrameCallback(() => {
          extractFrameData();
        });
      } else {
        // Fallback to seeked event
        const onSeeked = () => {
          extractFrameData();
          previewVideo.removeEventListener('seeked', onSeeked);
        };
        previewVideo.addEventListener('seeked', onSeeked);
      }
    },
    [],
  );

  // Debounced hover handler with reduced delay (100ms instead of 300ms)
  const onProgressMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!player || grabbing) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const progress = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const hoverTime = progress * (player.duration || 0);

      setHoverPosition(progress);

      // Clear previous timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      // Reduced debounce delay for faster response (100ms instead of 300ms)
      hoverTimeoutRef.current = setTimeout(() => {
        extractFrame(hoverTime);
      }, 10);
    },
    [player, grabbing, extractFrame],
  );

  const onProgressMouseLeave = useCallback(() => {
    setHoverPosition(null);
    setPreviewImage(null);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', onGrabMove);
    document.addEventListener('mouseup', onDocumentMouseUp);
    return () => {
      document.removeEventListener('mousemove', onGrabMove);
      document.removeEventListener('mouseup', onDocumentMouseUp);
    };
  }, [onGrabMove, onDocumentMouseUp]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const duration = player?.duration || 0;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  const getDuration = useCallback((time: number) => {
    const safeTime = time === Infinity ? 0 : time;
    const date = new Date(safeTime * 1000).toISOString().substr(11, 8);
    return date;
  }, []);

  return (
    <div
      className={`relative h-3 w-full rounded-full bg-white/10 ${grabbing ? 'cursor-grabbing' : 'cursor-pointer'}`}
      onMouseDown={onProgressMouseDown}
      onMouseMove={onProgressMouseMove}
      onMouseLeave={onProgressMouseLeave}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-rose-500" style={{ width: `${progress}%` }}>
        <div className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded-full border-2 border-white bg-amber-400" />
      </div>
      <div className="pointer-events-none absolute inset-0">
        {subtitle.length <= 200
          ? subtitle.map((item, index) => (
            <span
              key={`${item.start}-${index}`}
              className="absolute top-0 h-full bg-white/20"
              style={{
                left: `${(item.startTime / (duration || 1)) * 100}%`,
                width: `${(item.duration / (duration || 1)) * 100}%`,
              }}
            />
          ))
          : null}
      </div>

      {/* Video frame preview tooltip */}
      {hoverPosition !== null && previewImage && (
        <div
          className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-lg border border-white/20 bg-black/90 p-2 shadow-xl"
          style={{ left: `${hoverPosition * 100}%` }}
        >
          <img src={previewImage} alt="Preview" className="rounded" />
          <div className="mt-1 text-center text-xs text-white/80">
            {getDuration(hoverPosition * duration)}
          </div>
        </div>
      )}
    </div>
  );
};

const Duration = ({ player, currentTime }: Pick<SubtitleEditorShared, 'player' | 'currentTime'>) => {
  const getDuration = useCallback((time: number) => {
    const safeTime = time === Infinity ? 0 : time;
    const date = new Date(safeTime * 1000).toISOString().substr(11, 8);
    return date;
  }, []);

  return (
    <div className="text-center text-sm font-semibold text-white/70">
      {getDuration(currentTime)} / {getDuration(player?.duration || 0)}
    </div>
  );
};

export default function FooterPanel(props: SubtitleEditorShared) {
  const footerRef = useRef<HTMLDivElement>(null);
  const [render, setRender] = useState<RenderState>({
    padding: 2,
    duration: 10,
    gridGap: 10,
    gridNum: 110,
    beginTime: -5,
  });

  const onWheel = useCallback(
    (event: WheelEvent) => {
      if (!props.player || !props.waveform || props.playing || !footerRef.current) {
        return;
      }

      if (!footerRef.current.contains(event.target as Node)) return;
      const deltaY = Math.sign(event.deltaY) / 5;
      const currentTime = clamp(props.player.currentTime + deltaY, 0, props.player.duration || 0);
      props.player.currentTime = currentTime;
      props.waveform.seek(currentTime);
      props.setCurrentTime(currentTime);
    },
    [props],
  );

  useEffect(() => {
    const onWheelThrottle = throttle(onWheel, 100);
    window.addEventListener('wheel', onWheelThrottle);
    return () => window.removeEventListener('wheel', onWheelThrottle);
  }, [onWheel]);

  if (!props.player) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/60">
        Load video to start editing
      </div>
    );
  }

  return (
    <div ref={footerRef} className="relative flex h-full flex-col gap-3">
      <Progress {...props} />
      <Duration {...props} />
      <div className="relative h-full overflow-hidden rounded-xl border border-white/5 bg-black/50">
        <WaveformCanvas player={props.player} setWaveform={props.setWaveform} setRender={setRender} />
        <div className="absolute inset-0 z-10 flex flex-col gap-2 p-3">
          <Grab {...props} />
          <Metronome {...props} render={render} />
          <Timeline {...props} render={render} />
        </div>
      </div>
    </div>
  );
}
