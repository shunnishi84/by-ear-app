import { hzToMidi } from './notes';
import type { RawNote } from './notes';
import type { PitchFrame } from './yin';

export interface SegmentOptions {
  /** Minimum YIN confidence for a voiced frame. */
  minConfidence?: number;
  /** Silence gate relative to the loudest frame, in dB. */
  gateDb?: number;
  /** Shortest note kept, seconds. */
  minNoteSec?: number;
  /** Lowest / highest MIDI accepted. */
  minMidi?: number;
  maxMidi?: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Offset (in semitones, -0.5..0.5) of the recording's tuning against A=440. */
export function estimateTuning(midis: number[]): number {
  if (midis.length === 0) return 0;
  // Circular mean of the fractional part.
  let c = 0, s = 0;
  for (const m of midis) {
    const a = 2 * Math.PI * (m - Math.round(m));
    c += Math.cos(a);
    s += Math.sin(a);
  }
  return Math.atan2(s, c) / (2 * Math.PI);
}

/** Turn a YIN pitch track into discrete monophonic notes. */
export function segmentNotes(frames: PitchFrame[], opts: SegmentOptions = {}): RawNote[] {
  const minConf = opts.minConfidence ?? 0.8;
  const gate = 10 ** ((opts.gateDb ?? -38) / 20);
  const minNote = opts.minNoteSec ?? 0.06;
  const minMidi = opts.minMidi ?? 28;
  const maxMidi = opts.maxMidi ?? 100;
  if (frames.length < 3) return [];
  const hop = frames[1].time - frames[0].time;
  const maxRms = Math.max(...frames.map((f) => f.rms));
  if (maxRms <= 0) return [];

  const raw = frames.map((f) => {
    const voiced = f.f0 > 0 && f.confidence >= minConf && f.rms >= maxRms * gate;
    const m = voiced ? hzToMidi(f.f0) : NaN;
    return voiced && m >= minMidi && m <= maxMidi ? m : NaN;
  });
  const tuning = estimateTuning(raw.filter((m) => !Number.isNaN(m)));

  // Median smoothing (5 frames) over voiced frames to kill octave blips.
  const smooth = raw.map((m, i) => {
    if (Number.isNaN(m)) return NaN;
    const win: number[] = [];
    for (let k = -2; k <= 2; k++) {
      const v = raw[i + k];
      if (v !== undefined && !Number.isNaN(v)) win.push(v);
    }
    return median(win) - tuning;
  });

  // Onsets from loudness jumps (re-articulated notes of the same pitch).
  const onset = frames.map((f, i) => {
    if (i < 3) return false;
    const prevMin = Math.min(frames[i - 1].rms, frames[i - 2].rms, frames[i - 3].rms);
    return f.rms > maxRms * gate * 2 && f.rms > prevMin * 1.8;
  });

  const notes: RawNote[] = [];
  let cur: { startIdx: number; pitches: number[]; peak: number } | null = null;
  let pendingPitch = NaN;
  let pendingCount = 0;
  const HOLD = 3; // frames a new pitch must persist before we switch

  const close = (endIdx: number) => {
    if (!cur) return;
    const dur = (endIdx - cur.startIdx) * hop;
    if (dur >= minNote && cur.pitches.length) {
      notes.push({
        start: frames[cur.startIdx].time - hop / 2,
        end: frames[endIdx - 1].time + hop / 2,
        midi: Math.round(median(cur.pitches)),
        velocity: Math.min(1, cur.peak / maxRms),
      });
    }
    cur = null;
  };

  for (let i = 0; i < frames.length; i++) {
    const m = smooth[i];
    if (Number.isNaN(m)) {
      close(i);
      pendingCount = 0;
      continue;
    }
    const r = Math.round(m);
    if (!cur) {
      cur = { startIdx: i, pitches: [r], peak: frames[i].rms };
      pendingCount = 0;
      continue;
    }
    const curPitch = Math.round(median(cur.pitches.slice(-8)));
    if (r !== curPitch) {
      if (r === pendingPitch) pendingCount++;
      else { pendingPitch = r; pendingCount = 1; }
      if (pendingCount >= HOLD) {
        const startIdx = i - HOLD + 1;
        // The last HOLD-1 frames belonged to the new note.
        cur.pitches.splice(cur.pitches.length - (HOLD - 1), HOLD - 1);
        close(startIdx);
        cur = { startIdx, pitches: Array(HOLD).fill(r), peak: frames[i].rms };
        pendingCount = 0;
      } else cur.pitches.push(r);
    } else {
      pendingCount = 0;
      if (onset[i] && (i - cur.startIdx) * hop >= minNote) {
        close(i);
        cur = { startIdx: i, pitches: [r], peak: frames[i].rms };
        continue;
      }
      cur.pitches.push(r);
    }
    cur.peak = Math.max(cur.peak, frames[i].rms);
  }
  close(frames.length);
  return notes;
}
