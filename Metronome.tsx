import { useCallback, useEffect, useMemo, useState } from 'react';
import DT from 'duration-time-conversion';
import type Sub from './lib/Sub';
import type { RenderState, SubtitleEditorShared } from './types';

interface MetronomeProps extends Pick<SubtitleEditorShared, 'subtitle' | 'newSub' | 'addSub' | 'player' | 'playing'> {
  render: RenderState;
}

function findIndex(subs: Sub[], startTime: number) {
  return subs.findIndex((item, index) => {
    return (
      (startTime >= item.endTime && !subs[index + 1]) ||
      (item.startTime <= startTime && item.endTime > startTime) ||
      (startTime >= item.endTime && subs[index + 1] && startTime < subs[index + 1].startTime)
    );
  });
}

export default function Metronome({ render, subtitle, newSub, addSub, player, playing }: MetronomeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [dragEndTime, setDragEndTime] = useState(0);
  const gridGap = useMemo(() => document.body.clientWidth / render.gridNum, [render.gridNum]);

  const getEventTime = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      return (event.pageX - render.padding * gridGap) / gridGap / 10 + render.beginTime;
    },
    [gridGap, render],
  );

  const onMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const clickTime = getEventTime(event);
      setIsDragging(true);
      setDragStartTime(clickTime);
      setDragEndTime(clickTime);
    },
    [getEventTime],
  );

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      if (playing) {
        player?.pause();
      }
      setDragEndTime(getEventTime(event));
    },
    [isDragging, playing, player, getEventTime],
  );

  const onDocumentMouseUp = useCallback(() => {
    if (isDragging) {
      if (dragStartTime > 0 && dragEndTime > 0 && dragEndTime - dragStartTime >= 0.2) {
        const index = findIndex(subtitle, dragStartTime) + 1;
        const start = DT.d2t(dragStartTime);
        const end = DT.d2t(dragEndTime);
        addSub(
          index,
          newSub({
            start,
            end,
            text: 'Sample subtitle text',
          }),
        );
      }
    }
    setIsDragging(false);
    setDragStartTime(0);
    setDragEndTime(0);
  }, [isDragging, dragStartTime, dragEndTime, subtitle, addSub, newSub]);

  useEffect(() => {
    document.addEventListener('mouseup', onDocumentMouseUp);
    return () => document.removeEventListener('mouseup', onDocumentMouseUp);
  }, [onDocumentMouseUp]);

  return (
    <div className="absolute inset-0 z-10 cursor-ew-resize" onMouseDown={onMouseDown} onMouseMove={onMouseMove}>
      {player && !playing && isDragging && dragEndTime > dragStartTime ? (
        <div
          className="pointer-events-none absolute inset-y-0 bg-emerald-500/40"
          style={{
            left: render.padding * gridGap + (dragStartTime - render.beginTime) * gridGap * 10,
            width: (dragEndTime - dragStartTime) * gridGap * 10,
          }}
        />
      ) : null}
    </div>
  );
}
