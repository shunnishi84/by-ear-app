import { TPQ } from '../model/types';
import type { Clef, InstrumentId, Score, TimeSig } from '../model/types';
import { ANALYSIS_RATE, toAnalysisRate } from './decode';
import { monophonicNotes } from './monophonic';
import type { RawNote } from './notes';
import { guessClef, guessKey, quantize } from './quantize';
import { beatPhase, estimateTempo, gridStart } from './tempo';

export type Mode = 'mono' | 'poly';

export interface TranscribeSettings {
  mode: Mode;
  /** null = detect */
  bpm: number | null;
  timeSig: TimeSig;
  /** Grid in ticks. */
  grid: number;
  /** null = detect */
  keyFifths: number | null;
  clef: Clef | 'auto';
  transpose: number;
  instrument: InstrumentId;
  startSec: number;
  endSec: number | null;
  minMidi: number;
  maxMidi: number;
}

export type Stage = 'decode' | 'pitch' | 'rhythm';

export interface TranscribeResult {
  score: Omit<Score, 'title' | 'composer'>;
  noteCount: number;
  detectedBpm: number;
}

export async function transcribe(
  buffer: AudioBuffer,
  s: TranscribeSettings,
  onProgress: (stage: Stage, ratio: number) => void,
): Promise<TranscribeResult> {
  onProgress('decode', 0);
  const samples = await toAnalysisRate(buffer, s.startSec, s.endSec ?? undefined);
  onProgress('decode', 1);

  let raw: RawNote[];
  if (s.mode === 'poly') {
    const { polyphonicNotes } = await import('./polyphonic');
    raw = await polyphonicNotes(samples, (r) => onProgress('pitch', r));
  } else {
    raw = await monophonicNotes(samples, ANALYSIS_RATE, { minMidi: s.minMidi, maxMidi: s.maxMidi }, (r) => onProgress('pitch', r));
  }
  raw = raw.filter((n) => n.midi >= s.minMidi && n.midi <= s.maxMidi);
  if (raw.length === 0) throw new Error('音が検出できませんでした。音量や解析範囲・音域を確認してください。');

  onProgress('rhythm', 0);
  const onsets = raw.map((n) => ({ t: n.start, w: 0.5 + n.velocity }));
  const est = estimateTempo(onsets);
  const bpm = s.bpm ?? est.bpm;
  const phase = s.bpm ? beatPhase(onsets, bpm) : est.phase;
  const offset = gridStart(raw[0].start, bpm, phase);
  const events = quantize(raw, { bpm, offsetSec: offset, grid: s.grid, timeSig: s.timeSig, poly: s.mode === 'poly' });
  const key = s.keyFifths === null ? guessKey(raw) : { fifths: s.keyFifths, mode: 'major' as const };
  const clef = s.clef === 'auto' ? guessClef(raw, s.transpose) : s.clef;
  onProgress('rhythm', 1);

  return {
    noteCount: raw.length,
    detectedBpm: est.bpm,
    score: {
      tempo: Math.round(bpm),
      timeSig: s.timeSig,
      keyFifths: key.fifths,
      keyMode: key.mode,
      clef,
      transpose: s.transpose,
      instrument: s.instrument,
      events,
      audio: { offsetSec: s.startSec + offset, tempo: bpm },
    },
  };
}

export const GRID_OPTIONS = [
  { label: '8分音符', ticks: TPQ / 2 },
  { label: '16分音符', ticks: TPQ / 4 },
  { label: '32分音符', ticks: TPQ / 8 },
];
