import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DT from 'duration-time-conversion';
import clamp from 'lodash/clamp';
import type Sub from './lib/Sub';
import type { RenderState, SubtitleEditorShared } from './types';
import { getKeyCode } from './utils';

function getCurrentSubs(subs: Sub[], beginTime: number, duration: number) {
  return subs.filter((item) => {
    return (
      (item.startTime >= beginTime && item.startTime <= beginTime + duration) ||
      (item.endTime >= beginTime && item.endTime <= beginTime + duration) ||
      (item.startTime < beginTime && item.endTime > beginTime + duration)
    );
  });
}

function magnetically(time: number, closeTime?: number) {
  if (closeTime === undefined) return time;
  if (time > closeTime - 0.1 && closeTime + 0.1 > time) {
    return closeTime;
  }
  return time;
}

interface TimelineProps
  extends Pick<SubtitleEditorShared, 'player' | 'subtitle' | 'currentTime' | 'checkSub' | 'removeSub' | 'hasSub' | 'updateSub' | 'mergeSub'> {
  render: RenderState;
}

export default function Timeline({
  player,
  subtitle,
  render,
  currentTime,
  checkSub,
  removeSub,
  hasSub,
  updateSub,
  mergeSub,
}: TimelineProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const subsRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    target: null as HTMLDivElement | null,
    sub: null as Sub | null,
    type: '' as 'left' | 'right' | 'move' | '',
    startX: 0,
    index: -1,
    width: 0,
    diffX: 0,
    dragging: false,
  });
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; target: Sub | null }>({
    visible: false,
    x: 0,
    y: 0,
    target: null,
  });
  const gridGap = useMemo(() => document.body.clientWidth / render.gridNum, [render.gridNum]);
  const currentSubs = useMemo(() => getCurrentSubs(subtitle, render.beginTime, render.duration), [subtitle, render]);
  const currentIndex = currentSubs.findIndex((item) => item.startTime <= currentTime && item.endTime > currentTime);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false, target: null }));
  }, []);

  useEffect(() => {
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, [closeContextMenu]);

  const onMouseDown = (sub: Sub, event: React.MouseEvent<HTMLDivElement>, type: 'left' | 'right' | 'move' = 'move') => {
    const state = dragState.current;
    state.sub = sub;
    if (event.button !== 0) return;
    state.dragging = true;
    state.type = type;
    state.startX = event.pageX;
    state.index = currentSubs.indexOf(sub);
    state.target = subsRef.current?.children[state.index] as HTMLDivElement;
    state.width = state.target ? parseFloat(getComputedStyle(state.target).width) : 0;
  };

  const onDoubleClick = (sub: Sub) => {
    const index = hasSub(sub);
    const prev = subtitle[index - 1];
    const next = subtitle[index + 1];
    if (prev && next && dragState.current.target) {
      const width = (next.startTime - prev.endTime) * 10 * gridGap;
      dragState.current.target.style.width = `${width}px`;
      const start = DT.d2t(prev.endTime);
      const end = DT.d2t(next.startTime);
      updateSub(sub, {
        start,
        end,
      });
    }
  };

  const onDocumentMouseMove = useCallback((event: MouseEvent) => {
    const state = dragState.current;
    if (state.dragging && state.target) {
      state.diffX = event.pageX - state.startX;
      if (state.type === 'left') {
        state.target.style.width = `${state.width - state.diffX}px`;
        state.target.style.transform = `translateX(${state.diffX}px)`;
      } else if (state.type === 'right') {
        state.target.style.width = `${state.width + state.diffX}px`;
      } else {
        state.target.style.transform = `translateX(${state.diffX}px)`;
      }
    }
  }, []);

  const onDocumentMouseUp = useCallback(() => {
    const state = dragState.current;
    if (state.dragging && state.target && state.diffX && state.sub) {
      const timeDiff = state.diffX / gridGap / 10;
      const index = hasSub(state.sub);
      const previous = subtitle[index - 1];
      const next = subtitle[index + 1];

      const startTime = magnetically(state.sub.startTime + timeDiff, previous ? previous.endTime : undefined);
      const endTime = magnetically(state.sub.endTime + timeDiff, next ? next.startTime : undefined);
      const width = (endTime - startTime) * 10 * gridGap;

      if (!((previous && endTime < previous.startTime) || (next && startTime > next.endTime))) {
        if (state.type === 'left') {
          if (startTime >= 0 && state.sub.endTime - startTime >= 0.2) {
            const start = DT.d2t(startTime);
            updateSub(state.sub, { start });
          } else {
            state.target.style.width = `${width}px`;
          }
        } else if (state.type === 'right') {
          if (endTime >= 0 && endTime - state.sub.startTime >= 0.2) {
            const end = DT.d2t(endTime);
            updateSub(state.sub, { end });
          } else {
            state.target.style.width = `${width}px`;
          }
        } else if (startTime > 0 && endTime > 0 && endTime - startTime >= 0.2) {
          const start = DT.d2t(startTime);
          const end = DT.d2t(endTime);
          updateSub(state.sub, { start, end });
        } else {
          state.target.style.width = `${width}px`;
        }
      }
      state.target.style.transform = 'translateX(0)';
    }
    state.type = '';
    state.startX = 0;
    state.width = 0;
    state.diffX = 0;
    state.dragging = false;
  }, [gridGap, hasSub, subtitle, updateSub]);

  useEffect(() => {
    document.addEventListener('mousemove', onDocumentMouseMove);
    document.addEventListener('mouseup', onDocumentMouseUp);
    return () => {
      document.removeEventListener('mousemove', onDocumentMouseMove);
      document.removeEventListener('mouseup', onDocumentMouseUp);
    };
  }, [onDocumentMouseMove, onDocumentMouseUp]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const state = dragState.current;
      const sub = state.index >= 0 ? currentSubs[state.index] : null;
      const keyCode = getKeyCode(event);
      if (!sub || !player || keyCode === undefined) return;
      switch (keyCode) {
        case 37:
          updateSub(sub, {
            start: DT.d2t(sub.startTime - 0.1),
            end: DT.d2t(sub.endTime - 0.1),
          });
          player.currentTime = clamp(sub.startTime - 0.1, 0, player.duration);
          break;
        case 39:
          updateSub(sub, {
            start: DT.d2t(sub.startTime + 0.1),
            end: DT.d2t(sub.endTime + 0.1),
          });
          player.currentTime = clamp(sub.startTime + 0.1, 0, player.duration);
          break;
        case 8:
        case 46:
          removeSub(sub);
          break;
        default:
          break;
      }
    },
    [currentSubs, player, removeSub, updateSub],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <div ref={blockRef} className="pointer-events-none absolute inset-0 z-20">
      <div ref={subsRef} className="relative h-full w-full">
        {currentSubs.map((sub, key) => (
          <div
            className={`pointer-events-auto absolute top-1/3 flex h-1/3 cursor-move items-center justify-center rounded-md border text-center text-sm text-white ${
              key === currentIndex ? 'bg-sky-500/50 border-sky-300/80' : checkSub(sub) ? 'bg-amber-600/60 border-amber-400/80' : 'bg-white/20 border-white/20'
            }`}
            key={`${sub.start}-${sub.end}-${key}`}
            style={{
              left: render.padding * gridGap + (sub.startTime - render.beginTime) * gridGap * 10,
              width: (sub.endTime - sub.startTime) * gridGap * 10,
            }}
            onClick={() => {
              if (player && player.duration >= sub.startTime) {
                player.currentTime = sub.startTime + 0.001;
              }
            }}
            onDoubleClick={() => onDoubleClick(sub)}
            onMouseDown={(event) => onMouseDown(sub, event)}
            onContextMenu={(event) => {
              event.preventDefault();
              dragState.current.sub = sub;
              setContextMenu({ visible: true, x: event.clientX, y: event.clientY, target: sub });
            }}
          >
            <div
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
              onMouseDown={(event) => {
                event.stopPropagation();
                onMouseDown(sub, event, 'left');
              }}
            />
            <div className="z-0 w-full px-2 text-xs leading-tight text-white/90">
              {`${sub.text}`.split(/\r?\n/).map((line, index) => (
                <p key={index}>{line}</p>
              ))}
              <span className="mt-1 block text-[10px] opacity-70">{sub.duration.toFixed(2)}s</span>
            </div>
            <div
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
              onMouseDown={(event) => {
                event.stopPropagation();
                onMouseDown(sub, event, 'right');
              }}
            />
          </div>
        ))}
      </div>
      {contextMenu.visible && contextMenu.target ? (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-white/20 bg-[#0F121A] text-sm shadow-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            type="button"
            className="block w-full px-4 py-2 text-left text-white hover:bg-white/10"
            onClick={() => {
              removeSub(contextMenu.target as Sub);
              closeContextMenu();
            }}
          >
            Delete
          </button>
          <button
            type="button"
            className="block w-full px-4 py-2 text-left text-white hover:bg-white/10"
            onClick={() => {
              mergeSub(contextMenu.target as Sub);
              closeContextMenu();
            }}
          >
            Merge
          </button>
        </div>
      ) : null}
    </div>
  );
}
