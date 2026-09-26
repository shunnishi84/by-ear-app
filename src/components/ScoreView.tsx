import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderScoreInto } from '../render/renderScore';
import type { ScoreRender } from '../render/renderScore';
import type { Score } from '../model/types';

interface Props {
  score: Score;
  selection: [number, number] | null;
  /** Event index under the playback cursor, or null when stopped. */
  playingEvent: number | null;
  onSelect: (index: number | null, extend: boolean) => void;
  /** Click on the staff of an already-selected event: `step` is the written diatonic index. */
  onStaffClick: (index: number, step: number) => void;
  onEditTitle: (field: 'title' | 'composer', value: string) => void;
}

const TOP_LINE_STEP = { treble: 5 * 7 + 3, bass: 3 * 7 + 5 }; // F5, A3

export function ScoreView({ score, selection, playingEvent, onSelect, onStaffClick, onEditTitle }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [render, setRender] = useState<ScoreRender | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(320, Math.min(1000, el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!host.current) return;
    try {
      setRender(renderScoreInto(host.current, score, width, selection, width < 520 ? 12 : 28));
      setError(null);
    } catch (e) {
      console.error(e);
      setError(String(e));
    }
  }, [score, width, selection]);

  // Keep the selection / playback cursor on screen.
  const focusEvent = playingEvent ?? (selection ? selection[1] : null);
  useEffect(() => {
    if (focusEvent === null || !render || !host.current) return;
    const hit = render.hits.find((h) => h.eventIndex === focusEvent);
    if (!hit) return;
    const sys = render.systems[hit.system];
    const rect = host.current.getBoundingClientRect();
    const top = rect.top + sys.top;
    const bottom = rect.top + sys.bottom;
    const margin = 120;
    if (top < margin || bottom > window.innerHeight - margin) {
      window.scrollBy({ top: top - window.innerHeight / 3, behavior: playingEvent !== null ? 'smooth' : 'auto' });
    }
  }, [focusEvent, render, playingEvent]);

  const handleClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (!render || !host.current) return;
    const rect = host.current.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const si = render.systems.findIndex((s) => y >= s.top && y <= s.bottom);
    if (si < 0) {
      onSelect(null, false);
      return;
    }
    const hits = render.hits.filter((h) => h.system === si);
    if (!hits.length) return;
    let best = hits.find((h) => x >= h.x - 4 && x <= h.x + h.w + 4);
    if (!best) {
      best = hits.reduce((a, b) => (Math.abs(b.x + b.w / 2 - x) < Math.abs(a.x + a.w / 2 - x) ? b : a));
    }
    const single = selection && selection[0] === selection[1] ? selection[0] : null;
    if (!ev.shiftKey && single === best.eventIndex) {
      const sys = render.systems[si];
      const stepsDown = Math.round((y - sys.topLineY) / 5);
      onStaffClick(best.eventIndex, TOP_LINE_STEP[score.clef] - stepsDown);
      return;
    }
    onSelect(best.eventIndex, ev.shiftKey);
  };

  // Playback cursor.
  let cursor: React.CSSProperties | null = null;
  if (playingEvent !== null && render) {
    const hit = render.hits.find((h) => h.eventIndex === playingEvent);
    if (hit) {
      const sys = render.systems[hit.system];
      cursor = { left: hit.x - 6, top: sys.top + 6, width: Math.max(hit.w + 12, 22), height: sys.bottom - sys.top - 12 };
    }
  }

  return (
    <div className="paper-wrap" ref={wrap}>
      <div className="paper" style={{ width }}>
        <header className="paper-head">
          <input
            className="title-input"
            value={score.title}
            placeholder="タイトル"
            aria-label="タイトル"
            onChange={(e) => onEditTitle('title', e.target.value)}
          />
          <input
            className="composer-input"
            value={score.composer}
            placeholder="作曲者 / 編曲者"
            aria-label="作曲者"
            onChange={(e) => onEditTitle('composer', e.target.value)}
          />
        </header>
        {error && <div className="render-error">描画エラー: {error}</div>}
        <div className="score-host-wrap">
          {cursor && <div className="play-cursor" style={cursor} />}
          <div className="score-host" ref={host} onClick={handleClick} data-testid="score" />
        </div>
      </div>
    </div>
  );
}
