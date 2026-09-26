import { detectKey } from '../model/theory';
import { measureTicks, newId, TPQ } from '../model/types';
import type { Clef, KeyMode, NoteEvent, TimeSig } from '../model/types';
import type { RawNote } from './notes';

export interface QuantizeOptions {
  bpm: number;
  /** Seconds in the audio that map to tick 0. */
  offsetSec: number;
  /** Grid in ticks (TPQ/4 = 16th). */
  grid: number;
  timeSig: TimeSig;
  /** Keep chords (polyphonic transcription). */
  poly: boolean;
}

interface QNote {
  s: number;
  e: number;
  midi: number;
}

function toTicks(notes: RawNote[], o: QuantizeOptions): QNote[] {
  const tps = (TPQ * o.bpm) / 60;
  const q = (sec: number) => Math.round(((sec - o.offsetSec) * tps) / o.grid) * o.grid;
  return notes
    .map((n) => {
      const s = Math.max(0, q(n.start));
      let e = q(n.end);
      if (e <= s) e = s + o.grid;
      return { s, e, midi: n.midi };
    })
    .sort((a, b) => a.s - b.s || b.midi - a.midi);
}

/** Close small gaps: detached playing is usually notated legato. */
function legato(notes: QNote[], grid: number): void {
  for (let i = 0; i < notes.length; i++) {
    const nextStart = notes.slice(i + 1).find((n) => n.s > notes[i].s)?.s;
    if (nextStart === undefined) continue;
    const gap = nextStart - notes[i].e;
    const len = notes[i].e - notes[i].s;
    if (gap > 0 && gap <= Math.max(grid, len / 2) && gap <= TPQ) notes[i].e = nextStart;
  }
}

function monoEvents(notes: QNote[]): NoteEvent[] {
  // Resolve overlaps: at equal starts keep the highest (melody) note.
  const seq: QNote[] = [];
  for (const n of notes) {
    const prev = seq[seq.length - 1];
    if (prev && n.s === prev.s) continue;
    if (prev && n.s < prev.e) prev.e = n.s;
    seq.push({ ...n });
  }
  const events: NoteEvent[] = [];
  let t = 0;
  for (const n of seq) {
    if (n.e <= n.s) continue;
    if (n.s > t) events.push({ id: newId(), pitches: [], ticks: n.s - t });
    events.push({ id: newId(), pitches: [n.midi], ticks: n.e - n.s });
    t = n.e;
  }
  return events;
}

/**
 * Chords as onset groups: notes that start together form one chord that lasts
 * until the next attack (or a clear rest). Held notes are re-struck rather
 * than producing a thicket of partial ties, which reads much better.
 */
function polyEvents(notes: QNote[], grid: number): NoteEvent[] {
  const groups = new Map<number, QNote[]>();
  for (const n of notes) groups.set(n.s, [...(groups.get(n.s) ?? []), n]);
  const startsSorted = [...groups.keys()].sort((a, b) => a - b);
  const events: NoteEvent[] = [];
  let t = 0;
  startsSorted.forEach((s, i) => {
    const g = groups.get(s)!;
    const next = startsSorted[i + 1];
    let e = Math.max(...g.map((n) => n.e));
    if (next !== undefined) {
      if (e > next || next - e <= Math.max(grid, (e - s) / 2)) e = next;
    }
    if (s > t) events.push({ id: newId(), pitches: [], ticks: s - t });
    const pitches = [...new Set(g.map((n) => n.midi))].sort((a, b) => a - b).slice(-6);
    events.push({ id: newId(), pitches, ticks: e - s });
    t = e;
  });
  return events;
}

export function quantize(raw: RawNote[], o: QuantizeOptions): NoteEvent[] {
  const notes = toTicks(raw, o);
  if (!o.poly) legato(notes, o.grid);
  const events = o.poly ? polyEvents(notes, o.grid) : monoEvents(notes);
  const mt = measureTicks(o.timeSig);
  const total = events.reduce((s, e) => s + e.ticks, 0);
  const rem = total % mt;
  if (rem || total === 0) events.push({ id: newId(), pitches: [], ticks: rem ? mt - rem : mt });
  return events;
}

export function guessKey(raw: RawNote[]): { fifths: number; mode: KeyMode } {
  return detectKey(raw.map((n) => ({ midi: n.midi, weight: n.end - n.start })));
}

/** Treble unless most of the written notes sit well below middle C. */
export function guessClef(raw: RawNote[], transpose: number): Clef {
  if (!raw.length) return 'treble';
  const ms = raw.map((n) => n.midi + transpose).sort((a, b) => a - b);
  return ms[Math.floor(ms.length / 2)] < 57 ? 'bass' : 'treble';
}
