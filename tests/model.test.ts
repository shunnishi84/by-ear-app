import { describe, expect, it } from 'vitest';
import { decompose, keyAlterations, letterNear, spell, writtenFifths } from '../src/model/theory';
import { layoutMeasures } from '../src/model/layout';
import { deleteMeasureAt, pasteAt, setDuration, splitAt } from '../src/model/edit';
import { note, rest, TPQ, totalTicks } from '../src/model/types';

const TS = { num: 4, den: 4 };
const Q = TPQ;

describe('theory', () => {
  it('spells by key', () => {
    expect(spell(66, 1)).toEqual({ letter: 'F', alter: 1, octave: 4 });
    expect(spell(70, -1)).toEqual({ letter: 'B', alter: -1, octave: 4 });
    expect(spell(61, 0)).toEqual({ letter: 'C', alter: 1, octave: 4 });
    expect(spell(61, -3)).toEqual({ letter: 'D', alter: -1, octave: 4 });
    expect(spell(71, -7)).toEqual({ letter: 'C', alter: -1, octave: 5 });
  });
  it('key signature alterations', () => {
    expect(keyAlterations(2)).toMatchObject({ F: 1, C: 1, G: 0 });
    expect(keyAlterations(-2)).toMatchObject({ B: -1, E: -1, A: 0 });
  });
  it('letters land near the previous note, with the key applied', () => {
    expect(letterNear('F', 1, 60)).toBe(66);
    expect(letterNear('B', 0, 60)).toBe(59);
  });
  it('transposes key signatures for B♭ instruments', () => {
    expect(writtenFifths(-2, 2)).toBe(0); // B♭ major concert -> C written
    expect(writtenFifths(0, 2)).toBe(2);
  });
  it('decomposes keeping beats visible', () => {
    expect(decompose(0, 3 * Q, Q).map((v) => [v.dur, v.dots])).toEqual([['h', 1]]);
    // Quarter starting on the "and" of a beat crosses the beat -> 8th + 8th
    expect(decompose(Q / 2, Q, Q).map((v) => v.dur)).toEqual(['8', '8']);
    expect(decompose(Q, 2 * Q, Q).map((v) => v.dur)).toEqual(['h']);
  });
});

describe('layout', () => {
  it('splits notes over the barline with a tie', () => {
    const ms = layoutMeasures([rest(3 * Q), note([60], 2 * Q), rest(3 * Q)], TS);
    expect(ms).toHaveLength(2);
    const pieces = ms.flatMap((m) => m.pieces).filter((p) => p.eventIndex === 1);
    expect(pieces).toHaveLength(2);
    expect(pieces[0].firstOfEvent && pieces[1].lastOfEvent).toBe(true);
  });
  it('pads incomplete measures', () => {
    const ms = layoutMeasures([note([60], Q)], TS);
    expect(ms[0].pieces.at(-1)?.eventIndex).toBe(-1);
  });
});

describe('edit', () => {
  const base = () => [note([60], Q), note([62], Q), note([64], Q), note([65], Q)];
  it('lengthening consumes following notes', () => {
    const ev = setDuration(base(), 0, 2 * Q, TS);
    expect(ev.map((e) => e.pitches[0])).toEqual([60, 64, 65]);
    expect(totalTicks(ev)).toBe(4 * Q);
  });
  it('shortening leaves a rest', () => {
    const ev = setDuration(base(), 0, Q / 2, TS);
    expect(ev.map((e) => [e.pitches[0], e.ticks])).toEqual([[60, Q / 2], [undefined, Q / 2], [62, Q], [64, Q], [65, Q]]);
  });
  it('splitAt ties the halves', () => {
    const ev = splitAt([note([60], 2 * Q)], Q);
    expect(ev).toHaveLength(2);
    expect(ev[0].tieNext).toBe(true);
  });
  it('deletes a measure', () => {
    const ev = deleteMeasureAt([...base(), note([67], 4 * Q)], 4, TS);
    expect(ev.map((e) => e.pitches[0])).toEqual([60, 62, 64, 65]);
  });
  it('pastes by overwriting', () => {
    const ev = pasteAt(base(), 1, [note([70], Q), note([71], Q)], TS);
    expect(ev.map((e) => e.pitches[0])).toEqual([60, 70, 71, 65]);
  });
});
