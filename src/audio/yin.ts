import { FFT } from './fft';

export interface PitchFrame {
  /** Frame centre in seconds. */
  time: number;
  /** Fundamental frequency in Hz (0 when unvoiced). */
  f0: number;
  /** 0..1, 1 - CMNDF minimum. */
  confidence: number;
  rms: number;
}

export interface YinOptions {
  sampleRate: number;
  window?: number;
  hop?: number;
  fmin?: number;
  fmax?: number;
  threshold?: number;
  onProgress?: (ratio: number) => void;
}

/**
 * YIN fundamental frequency tracker (de Cheveigné & Kawahara 2002). The
 * difference function is computed through an FFT cross-correlation so a
 * several-minute recording analyses in a few seconds.
 */
export function yinTrack(samples: Float32Array, opts: YinOptions): PitchFrame[] {
  const sr = opts.sampleRate;
  const W = opts.window ?? 1024;
  const hop = opts.hop ?? 256;
  const fmin = opts.fmin ?? 50;
  const fmax = opts.fmax ?? 2000;
  const threshold = opts.threshold ?? 0.15;
  const tauMax = Math.min(Math.ceil(sr / fmin), W);
  const tauMin = Math.max(2, Math.floor(sr / fmax));
  const N = W + tauMax;
  let M = 1;
  while (M < N) M <<= 1;
  const fft = new FFT(M);
  const aRe = new Float64Array(M), aIm = new Float64Array(M);
  const bRe = new Float64Array(M), bIm = new Float64Array(M);
  const cmnd = new Float64Array(tauMax + 1);
  const d = new Float64Array(tauMax + 1);
  const sq = new Float64Array(N + 1);
  const frames: PitchFrame[] = [];
  const count = Math.max(0, Math.floor((samples.length - N) / hop) + 1);

  for (let f = 0; f < count; f++) {
    const off = f * hop;
    aRe.fill(0); aIm.fill(0); bRe.fill(0); bIm.fill(0);
    sq[0] = 0;
    for (let i = 0; i < N; i++) {
      const x = samples[off + i];
      aRe[i] = x;
      if (i < W) bRe[i] = x;
      sq[i + 1] = sq[i] + x * x;
    }
    const e1 = sq[W];
    const rms = Math.sqrt(e1 / W);
    if (rms < 1e-5) {
      frames.push({ time: (off + W / 2) / sr, f0: 0, confidence: 0, rms });
      continue;
    }
    fft.transform(aRe, aIm);
    fft.transform(bRe, bIm);
    // A * conj(B)
    for (let i = 0; i < M; i++) {
      const r = aRe[i] * bRe[i] + aIm[i] * bIm[i];
      const im = aIm[i] * bRe[i] - aRe[i] * bIm[i];
      aRe[i] = r; aIm[i] = im;
    }
    fft.transform(aRe, aIm, true);
    d[0] = 0;
    cmnd[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      const r = aRe[tau] / M;
      const e2 = sq[tau + W] - sq[tau];
      d[tau] = Math.max(0, e1 + e2 - 2 * r);
      running += d[tau];
      cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }
    // First dip below the threshold, then walk to its local minimum.
    let best = -1;
    for (let tau = tauMin; tau < tauMax; tau++) {
      if (cmnd[tau] < threshold) {
        while (tau + 1 < tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
        best = tau;
        break;
      }
    }
    if (best < 0) {
      // No clear period: take the global minimum but report low confidence.
      let mv = Infinity;
      for (let tau = tauMin; tau < tauMax; tau++) if (cmnd[tau] < mv) { mv = cmnd[tau]; best = tau; }
    }
    let period = best;
    if (best > tauMin && best < tauMax - 1) {
      const s0 = cmnd[best - 1], s1 = cmnd[best], s2 = cmnd[best + 1];
      const den = s0 + s2 - 2 * s1;
      if (den !== 0) period = best + (s0 - s2) / (2 * den);
    }
    frames.push({
      time: (off + W / 2) / sr,
      f0: period > 0 ? sr / period : 0,
      confidence: Math.max(0, 1 - cmnd[best]),
      rms,
    });
    if (opts.onProgress && f % 200 === 0) opts.onProgress(f / count);
  }
  opts.onProgress?.(1);
  return frames;
}
