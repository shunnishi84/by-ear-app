import { beatTicksFor } from '../model/theory';
import { measureTicks, totalTicks, TPQ } from '../model/types';
import type { InstrumentId, Score } from '../model/types';
import { audioContext } from './decode';
import { midiToHz } from './notes';

export const INSTRUMENTS: { id: InstrumentId; label: string }[] = [
  { id: 'piano', label: 'ピアノ' },
  { id: 'trumpet', label: 'トランペット' },
  { id: 'steelpan', label: 'スティールパン' },
  { id: 'flute', label: 'フルート' },
  { id: 'organ', label: 'オルガン' },
];

interface Sounding {
  start: number;
  end: number;
  midi: number;
}

/** Flatten events to sounding notes, merging tied continuations. */
export function soundingNotes(score: Score): Sounding[] {
  const out: Sounding[] = [];
  const open = new Map<number, Sounding>();
  let t = 0;
  score.events.forEach((e, i) => {
    const prev = score.events[i - 1];
    const next = new Map<number, Sounding>();
    for (const p of e.pitches) {
      const carried = prev?.tieNext ? open.get(p) : undefined;
      if (carried) {
        carried.end = t + e.ticks;
        next.set(p, carried);
      } else {
        const s = { start: t, end: t + e.ticks, midi: p };
        out.push(s);
        next.set(p, s);
      }
    }
    open.clear();
    next.forEach((v, k) => open.set(k, v));
    t += e.ticks;
  });
  return out;
}

function voice(ctx: BaseAudioContext, dest: AudioNode, inst: InstrumentId, midi: number, t: number, dur: number, vel = 0.8) {
  const f = midiToHz(midi);
  const g = ctx.createGain();
  g.connect(dest);
  const oscs: OscillatorNode[] = [];
  const osc = (type: OscillatorType, freq: number, gain: number, target: AudioNode = g) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const og = ctx.createGain();
    og.gain.value = gain;
    o.connect(og).connect(target);
    oscs.push(o);
    return o;
  };
  const end = t + dur;
  let stopAt = end + 0.3;
  const amp = 0.22 * vel;
  switch (inst) {
    case 'piano': {
      osc('triangle', f, 1);
      osc('sine', f * 2, 0.25);
      osc('sine', f * 3, 0.06);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * 1.2, t + 0.005);
      g.gain.setTargetAtTime(amp * 0.25, t + 0.01, 0.5);
      g.gain.setTargetAtTime(0, end, 0.08);
      stopAt = end + 0.6;
      break;
    }
    case 'steelpan': {
      osc('sine', f, 1);
      osc('sine', f * 2, 0.45);
      osc('sine', f * 3, 0.12);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * 1.3, t + 0.004);
      g.gain.setTargetAtTime(0, t + 0.01, Math.min(0.9, dur * 0.8 + 0.25));
      g.gain.setTargetAtTime(0, end + 0.1, 0.1);
      stopAt = end + 1.2;
      break;
    }
    case 'trumpet': {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 1.5;
      lp.frequency.setValueAtTime(f * 1.5, t);
      lp.frequency.linearRampToValueAtTime(Math.min(9000, f * 6), t + 0.05);
      lp.frequency.setTargetAtTime(f * 4, t + 0.06, 0.2);
      lp.connect(g);
      const o = osc('sawtooth', f, 0.9, lp);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, dur));
      lfo.connect(depth).connect(o.frequency);
      oscs.push(lfo);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * 0.9, t + 0.03);
      g.gain.setTargetAtTime(amp * 0.7, t + 0.04, 0.1);
      g.gain.setTargetAtTime(0, end - 0.01, 0.03);
      break;
    }
    case 'flute': {
      const o = osc('sine', f, 1);
      osc('triangle', f, 0.15);
      osc('sine', f * 2, 0.08);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5;
      const depth = ctx.createGain();
      depth.gain.value = f * 0.004;
      lfo.connect(depth).connect(o.frequency);
      oscs.push(lfo);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.06);
      g.gain.setTargetAtTime(0, end - 0.01, 0.04);
      break;
    }
    case 'organ': {
      osc('sine', f, 1);
      osc('sine', f * 2, 0.5);
      osc('sine', f * 3, 0.25);
      osc('sine', f * 4, 0.12);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * 0.7, t + 0.01);
      g.gain.setTargetAtTime(0, end - 0.005, 0.02);
      break;
    }
  }
  for (const o of oscs) {
    o.start(t);
    o.stop(stopAt);
  }
  oscs[0].onended = () => g.disconnect();
}

function click(ctx: BaseAudioContext, dest: AudioNode, t: number, accent: boolean) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = accent ? 1760 : 1175;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(accent ? 0.35 : 0.22, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.06);
}

export interface PlayOptions {
  fromTick: number;
  metronome: boolean;
  scoreVolume: number;
  original?: AudioBuffer | null;
  originalVolume: number;
  /** Called every animation frame with the current tick. */
  onTick: (tick: number) => void;
  onEnd: () => void;
}

export class Player {
  private master: GainNode | null = null;
  private timer: number | null = null;
  private raf: number | null = null;
  private src: AudioBufferSourceNode | null = null;
  playing = false;

  play(score: Score, o: PlayOptions): void {
    this.stop();
    const ctx = audioContext();
    void ctx.resume();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    const master = ctx.createGain();
    master.connect(comp);
    this.master = master;
    const scoreBus = ctx.createGain();
    scoreBus.gain.value = o.scoreVolume;
    scoreBus.connect(master);

    const secPerTick = 60 / score.tempo / TPQ;
    const t0 = ctx.currentTime + 0.12;
    const at = (tick: number) => t0 + (tick - o.fromTick) * secPerTick;
    const end = totalTicks(score.events);
    const notes = soundingNotes(score).filter((n) => n.start >= o.fromTick);
    const beat = beatTicksFor(score.timeSig.num, score.timeSig.den);
    const mt = measureTicks(score.timeSig);

    if (o.original && score.audio && o.originalVolume > 0) {
      const rate = score.tempo / score.audio.tempo;
      const offset = score.audio.offsetSec + (o.fromTick / TPQ) * (60 / score.audio.tempo);
      if (offset < o.original.duration) {
        const src = ctx.createBufferSource();
        src.buffer = o.original;
        src.playbackRate.value = rate;
        const g = ctx.createGain();
        g.gain.value = o.originalVolume;
        src.connect(g).connect(master);
        if (offset >= 0) src.start(t0, offset);
        else src.start(t0 - offset / rate, 0);
        this.src = src;
      }
    }

    let ni = 0;
    let nextBeat = Math.ceil(o.fromTick / beat) * beat;
    const schedule = () => {
      const horizon = ctx.currentTime + 0.25;
      while (ni < notes.length && at(notes[ni].start) < horizon) {
        const n = notes[ni++];
        voice(ctx, scoreBus, score.instrument, n.midi, at(n.start), (n.end - n.start) * secPerTick);
      }
      while (o.metronome && nextBeat < end && at(nextBeat) < horizon) {
        click(ctx, master, at(nextBeat), nextBeat % mt === 0);
        nextBeat += beat;
      }
    };
    schedule();
    this.timer = window.setInterval(schedule, 50);
    this.playing = true;
    const frame = () => {
      const tick = o.fromTick + (ctx.currentTime - t0) / secPerTick;
      if (tick >= end) {
        this.stop();
        o.onEnd();
        return;
      }
      o.onTick(Math.max(o.fromTick, tick));
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.timer = this.raf = null;
    try {
      this.src?.stop();
    } catch {
      /* already stopped */
    }
    this.src = null;
    if (this.master) {
      const m = this.master;
      const ctx = audioContext();
      m.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => m.disconnect(), 200);
    }
    this.master = null;
  }

  /** Short audition when a note is entered or changed. */
  preview(pitches: number[], inst: InstrumentId): void {
    if (!pitches.length) return;
    const ctx = audioContext();
    void ctx.resume();
    const g = ctx.createGain();
    g.gain.value = 0.8;
    g.connect(ctx.destination);
    for (const p of pitches) voice(ctx, g, inst, p, ctx.currentTime + 0.01, 0.35, 0.7);
    setTimeout(() => g.disconnect(), 2000);
  }
}

export const tickToSec = (score: Score, tick: number) => (tick / TPQ) * (60 / score.tempo);
