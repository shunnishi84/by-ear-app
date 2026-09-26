import type { DurKey } from '../model/theory';

/** Tiny engraved-looking note glyphs for the toolbar. */
export function NoteIcon({ dur, rest = false }: { dur: DurKey; rest?: boolean }) {
  if (rest) return <RestIcon />;
  const filled = dur !== 'w' && dur !== 'h';
  const stem = dur !== 'w';
  const flags = dur === '8' ? 1 : dur === '16' ? 2 : dur === '32' ? 3 : 0;
  return (
    <svg viewBox="0 0 24 28" width="18" height="21" aria-hidden="true">
      <ellipse
        cx="9"
        cy="22"
        rx="5.2"
        ry="3.6"
        transform="rotate(-20 9 22)"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.8}
      />
      {stem && <line x1="13.6" y1="21" x2="13.6" y2="3" stroke="currentColor" strokeWidth="1.6" />}
      {Array.from({ length: flags }, (_, i) => (
        <path key={i} d={`M13.6 ${3 + i * 5} q 6 3 5 9`} fill="none" stroke="currentColor" strokeWidth="1.8" />
      ))}
    </svg>
  );
}

function RestIcon() {
  return (
    <svg viewBox="0 0 24 28" width="18" height="21" aria-hidden="true">
      <path d="M9 4 l6 7 -4 5 5 7 c-4-2-7 0-4 4 c-5-3-4-8 0-7 l-5-6 4-5z" fill="currentColor" />
    </svg>
  );
}

export const Icon = {
  play: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4v16l13-8z" fill="currentColor" /></svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /></svg>
  ),
  stop: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6h12v12H6z" fill="currentColor" /></svg>
  ),
  start: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor" /></svg>
  ),
  undo: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 7H4V2M4.5 7A9 9 0 1 1 3 13" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
  ),
  redo: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 7h5V2M19.5 7A9 9 0 1 0 21 13" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
  ),
  metronome: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 3h6l4 18H5zM12 17l5-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
  ),
  wave: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2 12h2M6 8v8M10 4v16M14 7v10M18 10v4M22 12h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="16" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="18" cy="18" r="2" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
  ),
};
