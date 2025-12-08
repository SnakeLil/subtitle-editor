import { memo, useCallback, useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import type { SubtitleEditorShared } from './types';
import { isPlaying } from './utils';
import backlight from './lib/backlight';

const VideoWrap = memo(
  ({ setPlayer, setCurrentTime, setPlaying, videoUrl }: Pick<SubtitleEditorShared, 'setPlayer' | 'setCurrentTime' | 'setPlaying' | 'videoUrl'>) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      setPlayer(video);
      let frameId = 0;
      const loop = () => {
        if (videoRef.current) {
          setPlaying(isPlaying(videoRef.current));
          setCurrentTime(videoRef.current.currentTime || 0);
        }
        frameId = window.requestAnimationFrame(loop);
      };
      frameId = window.requestAnimationFrame(loop);
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }, [setPlayer, setCurrentTime, setPlaying]);

    const handleClick = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (isPlaying(video)) {
        video.pause();
      } else {
        video.play();
      }
    }, []);

    return (
      <video
        ref={videoRef}
        onClick={handleClick}
        src={videoUrl}
        crossOrigin="anonymous"
        className="relative z-10 max-h-full max-w-full cursor-pointer rounded-none border border-white/10 bg-black shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
      />
    );
  },
  (prev, next) => prev.videoUrl === next.videoUrl,
);

export default function PlayerPanel(props: SubtitleEditorShared) {
  const [currentSub, setCurrentSub] = useState(props.subtitle[props.currentIndex] ?? null);
  const [focusing, setFocusing] = useState(false);
  const [inputItemCursor, setInputItemCursor] = useState(0);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const backlightAttached = useRef(false);

  useEffect(() => {
    if (playerContainerRef.current && props.player && !backlightAttached.current) {
      backlightAttached.current = true;
      backlight(playerContainerRef.current, props.player);
    }
  }, [props.player]);

  useEffect(() => {
    setCurrentSub(props.subtitle[props.currentIndex] ?? null);
  }, [props.subtitle, props.currentIndex]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!props.player || !currentSub) return;
      props.player.pause();
      props.updateSub(currentSub, { text: event.target.value });
      if (typeof event.target.selectionStart === 'number') {
        setInputItemCursor(event.target.selectionStart);
      }
    },
    [props, currentSub],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLTextAreaElement>) => {
      if (!props.player || !currentSub) return;
      props.player.pause();
      if (typeof event.currentTarget.selectionStart === 'number') {
        setInputItemCursor(event.currentTarget.selectionStart);
      }
    },
    [props, currentSub],
  );

  const handleFocus = useCallback((event: React.FocusEvent<HTMLTextAreaElement>) => {
    setFocusing(true);
    if (typeof event.target.selectionStart === 'number') {
      setInputItemCursor(event.target.selectionStart);
    }
  }, []);

  const handleBlur = useCallback(() => {
    setTimeout(() => setFocusing(false), 300);
  }, []);

  const handleSplit = useCallback(() => {
    if (currentSub) {
      props.splitSub(currentSub, inputItemCursor);
    }
  }, [props, currentSub, inputItemCursor]);

  return (
    <div className="flex h-full items-center justify-center">
      <div ref={playerContainerRef} className="relative flex items-center justify-center">
        <VideoWrap {...props} />
        {props.player && currentSub ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-2 px-5 text-center">
            {focusing ? (
              <button
                type="button"
                onClick={handleSplit}
                className="pointer-events-auto rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium tracking-wide text-white hover:bg-white/20"
              >
                Split
              </button>
            ) : null}
            <TextareaAutosize
              className={`pointer-events-auto w-full max-w-[600px] resize-none rounded-lg border border-white/10 px-4 py-3 text-center text-lg font-semibold text-white shadow-[0_2px_30px_rgba(0,0,0,0.6)] outline-none focus:border-white/50 ${props.playing ? 'bg-black/40' : 'bg-black/70'
                }`}
              value={currentSub.text}
              onChange={handleChange}
              onClick={handleClick}
              onFocus={handleFocus}
              onBlur={handleBlur}
              spellCheck={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
