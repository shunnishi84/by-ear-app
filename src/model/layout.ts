import { beatTicksFor, decompose } from './theory';
import type { NoteValue } from './theory';
import { measureTicks } from './types';
import type { NoteEvent, TimeSig } from './types';

/** A written note/rest: one event may be split into several tied pieces. */
export interface Piece {
  /** Index into score.events, or -1 for padding added by the layout. */
  eventIndex: number;
  pitches: number[];
  value: NoteValue;
  /** Tick offset inside the measure. */
  pos: number;
  /** Absolute tick. */
  tick: number;
  firstOfEvent: boolean;
  lastOfEvent: boolean;
}

export interface MeasureLayout {
  index: number;
  startTick: number;
  pieces: Piece[];
}

export function layoutMeasures(events: NoteEvent[], ts: TimeSig): MeasureLayout[] {
  const mt = measureTicks(ts);
  const beat = beatTicksFor(ts.num, ts.den);
  const measures: MeasureLayout[] = [];
  const ensure = (m: number) => {
    while (measures.length <= m) measures.push({ index: measures.length, startTick: measures.length * mt, pieces: [] });
    return measures[m];
  };
  let t = 0;
  const place = (eventIndex: number, pitches: number[], start: number, ticks: number) => {
    const pieces: Piece[] = [];
    let cur = start;
    let left = ticks;
    while (left > 0) {
      const m = Math.floor(cur / mt);
      const pos = cur - m * mt;
      const span = Math.min(left, mt - pos);
      let p = pos;
      for (const value of decompose(pos, span, beat)) {
        const piece: Piece = { eventIndex, pitches, value, pos: p, tick: m * mt + p, firstOfEvent: false, lastOfEvent: false };
        ensure(m).pieces.push(piece);
        pieces.push(piece);
        p += value.ticks;
      }
      cur += span;
      left -= span;
    }
    if (pieces.length) {
      pieces[0].firstOfEvent = true;
      pieces[pieces.length - 1].lastOfEvent = true;
    }
  };
  events.forEach((e, i) => {
    place(i, e.pitches, t, e.ticks);
    t += e.ticks;
  });
  const rem = t % mt;
  if (rem !== 0 || measures.length === 0) place(-1, [], t, rem === 0 ? mt : mt - rem);
  return measures;
}
