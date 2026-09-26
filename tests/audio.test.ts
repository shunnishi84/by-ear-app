import { describe, expect, it } from 'vitest';
import { yinTrack } from '../src/audio/yin';
import { segmentNotes } from '../src/audio/segment';
import { estimateTempo, gridStart, tapTempo } from '../src/audio/tempo';
import { quantize, guessKey } from '../src/audio/quantize';
import { TPQ } from '../src/model/types';
import { renderMelody } from './synth';

const SR = 22050;
// "Twinkle twinkle" in G: quarters and a half at the end of each phrase.
const MELODY: [number | null, number][] = [
  [67, 1], [67, 1], [74, 1], [74, 1], [76, 1], [76, 1], [74, 2],
  [72, 1], [72, 1], [71, 1], [71, 1], [69, 0.5], [69, 0.5], [71, 0.5], [69, 0.5], [67, 2],
];

describe('yin', () => {
  it('tracks a steady A4', () => {
    const audio = renderMelody([[69, 4]], 120, SR, 0, 0);
    const frames = yinTrack(audio, { sampleRate: SR });
    const voiced = frames.filter((f) => f.confidence > 0.8);
    expect(voiced.length).toBeGreaterThan(frames.length * 0.8);
    const mean = voiced.reduce((s, f) => s + f.f0, 0) / voiced.length;
    expect(mean).toBeGreaterThan(437);
    expect(mean).toBeLessThan(443);
  });
});

describe('pipeline', () => {
  const audio = renderMelody(MELODY, 100, SR);
  const frames = yinTrack(audio, { sampleRate: SR });
  const raw = segmentNotes(frames);

  it('finds each note with the right pitch', () => {
    expect(raw.map((n) => n.midi)).toEqual(MELODY.map(([m]) => m));
  });

  it('estimates tempo and quantises the rhythm', () => {
    const est = estimateTempo(raw.map((n) => ({ t: n.start, w: 1 })));
    expect(Math.abs(est.bpm - 100)).toBeLessThan(3);
    const offset = gridStart(raw[0].start, est.bpm, est.phase);
    const events = quantize(raw, { bpm: est.bpm, offsetSec: offset, grid: TPQ / 4, timeSig: { num: 4, den: 4 }, poly: false });
    const notes = events.filter((e) => e.pitches.length);
    expect(notes.map((e) => e.ticks / TPQ)).toEqual(MELODY.map(([, b]) => b));
  });

  it('guesses the key', () => {
    expect(guessKey(raw).fifths).toBe(1);
  });
});

describe('tap tempo', () => {
  it('uses the median interval', () => {
    expect(tapTempo([0, 0.5, 1.0, 1.52, 2.0])).toBe(120);
  });
});
