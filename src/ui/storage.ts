import { emptyScore } from '../model/types';
import type { Score } from '../model/types';

const KEY = 'by-ear:score:v1';

export function loadScore(): Score {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return validateScore(JSON.parse(raw));
  } catch {
    /* ignore corrupt / unavailable storage */
  }
  return emptyScore();
}

export function saveScore(s: Score): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: autosave is best-effort */
  }
}

/** Accept a project file, filling in anything missing. */
export function validateScore(x: unknown): Score {
  const base = emptyScore();
  if (!x || typeof x !== 'object') throw new Error('invalid project');
  const o = x as Partial<Score>;
  if (!Array.isArray(o.events)) throw new Error('invalid project: events missing');
  const events = o.events
    .filter((e) => e && typeof e.ticks === 'number' && e.ticks > 0 && Array.isArray(e.pitches))
    .map((e) => ({
      id: String(e.id ?? Math.random()),
      ticks: Math.round(e.ticks),
      pitches: e.pitches.filter((p) => typeof p === 'number'),
      tieNext: !!e.tieNext,
    }));
  return { ...base, ...o, events: events.length ? events : base.events };
}
