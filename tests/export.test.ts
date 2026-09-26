import { describe, expect, it } from 'vitest';
import { toMidi } from '../src/export/midi';
import { toMusicXML } from '../src/export/musicxml';
import { soundingNotes } from '../src/audio/player';
import { emptyScore, note, rest, TPQ } from '../src/model/types';
import type { Score } from '../src/model/types';

const Q = TPQ;
const score = (patch: Partial<Score>): Score => ({ ...emptyScore(), ...patch });

describe('MusicXML', () => {
  it('writes pitches, a barline tie and B♭ transposition', () => {
    const s = score({
      title: 'A & B',
      transpose: 2,
      keyFifths: -2,
      events: [note([70], 3 * Q), note([72], 2 * Q), rest(3 * Q)],
    });
    const xml = toMusicXML(s);
    expect(xml).toContain('<work-title>A &amp; B</work-title>');
    expect(xml).toContain('<fifths>0</fifths>'); // B♭ major concert = C major written
    expect(xml).toContain('<chromatic>-2</chromatic>');
    expect(xml).toContain('<step>C</step>'); // concert B♭4 written as C5
    expect(xml.match(/<tie type="start"\/>/g)).toHaveLength(1);
    expect(xml.match(/<measure /g)).toHaveLength(2);
  });
});

describe('MIDI', () => {
  it('produces a valid header and merges tied notes', () => {
    const s = score({ events: [{ ...note([60], Q), tieNext: true }, note([60], Q), rest(2 * Q)] });
    expect(soundingNotes(s)).toEqual([{ start: 0, end: 2 * Q, midi: 60 }]);
    const bytes = toMidi(s);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    expect(String.fromCharCode(...bytes.slice(14, 18))).toBe('MTrk');
  });
});
