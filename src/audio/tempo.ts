export interface TempoEstimate {
  bpm: number;
  /** Time (s) of a beat-grid point; the grid is phase + k * 60/bpm. */
  phase: number;
}

/** Resultant length of onsets folded onto a period (1 = perfectly periodic). */
function periodicity(onsets: { t: number; w: number }[], period: number): { r: number; angle: number } {
  let c = 0, s = 0, tw = 0;
  for (const o of onsets) {
    const a = (2 * Math.PI * o.t) / period;
    c += o.w * Math.cos(a);
    s += o.w * Math.sin(a);
    tw += o.w;
  }
  return { r: tw ? Math.hypot(c, s) / tw : 0, angle: Math.atan2(s, c) };
}

const phaseOf = (angle: number, period: number) => {
  const p = (angle / (2 * Math.PI)) * period;
  return ((p % period) + period) % period;
};

/**
 * Estimate tempo from note onsets. Each candidate is scored by how well the
 * onsets line up with its beat and eighth-note grids, weighted by a prior
 * centred on ~110 BPM to settle half/double-time ambiguity.
 */
export function estimateTempo(onsets: { t: number; w: number }[], minBpm = 50, maxBpm = 200): TempoEstimate {
  if (onsets.length < 3) return { bpm: 120, phase: onsets[0]?.t ?? 0 };
  let best = { score: -1, bpm: 120 };
  for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.5) {
    const T = 60 / bpm;
    const beat = periodicity(onsets, T).r;
    const eighth = periodicity(onsets, T / 2).r;
    const sixteenth = periodicity(onsets, T / 4).r;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.5) ** 2);
    const score = (0.45 * beat + 0.4 * eighth + 0.15 * sixteenth) * (0.35 + 0.65 * prior);
    if (score > best.score) best = { score, bpm };
  }
  return { bpm: best.bpm, phase: beatPhase(onsets, best.bpm) };
}

/** Phase of the beat grid for a known tempo. */
export function beatPhase(onsets: { t: number; w: number }[], bpm: number): number {
  const T = 60 / bpm;
  // Fold on the eighth-note grid first (robust), then decide which of the two
  // eighth positions is the beat using the quarter-note fold.
  const e = periodicity(onsets, T / 2);
  const p8 = phaseOf(e.angle, T / 2);
  const q = periodicity(onsets, T);
  const pq = phaseOf(q.angle, T);
  const cand = [p8, p8 + T / 2];
  const dist = (a: number) => Math.min(Math.abs(a - pq), T - Math.abs(a - pq));
  return dist(cand[0]) <= dist(cand[1]) ? cand[0] : cand[1];
}

/**
 * Where tick 0 goes: the beat at (or just after, within a 16th) the first
 * onset, so the score starts on a downbeat.
 */
export function gridStart(firstOnset: number, bpm: number, phase: number): number {
  const T = 60 / bpm;
  const k = Math.floor((firstOnset - phase) / T + 0.25);
  return phase + k * T;
}

/** Tempo from a list of tap times (seconds). */
export function tapTempo(taps: number[]): number | null {
  if (taps.length < 3) return null;
  const iv = taps.slice(1).map((t, i) => t - taps[i]).filter((x) => x > 0.2 && x < 2);
  if (iv.length < 2) return null;
  iv.sort((a, b) => a - b);
  const med = iv[Math.floor(iv.length / 2)];
  return Math.round(60 / med);
}
