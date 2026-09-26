import { Accidental, Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow/bravura';
import type { RenderContext } from 'vexflow/bravura';
import { layoutMeasures } from '../model/layout';
import type { MeasureLayout, Piece } from '../model/layout';
import { keyAlterations, spell, writtenFifths } from '../model/theory';
import type { Score } from '../model/types';

const KEY_SPEC: Record<number, string> = {
  [-7]: 'Cb', [-6]: 'Gb', [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb', [-2]: 'Bb', [-1]: 'F',
  0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
};
const ACC_CODE: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: 'n', 1: '#', 2: '##' };

/** Vertical size of a stave with the default 4 spaces above and below. */
const STAVE_H = 120;
const LINE = 10;

export const COLORS = {
  ink: '#1b1f24',
  select: '#1f6feb',
};

export interface NoteHit {
  eventIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  system: number;
}

export interface SystemBox {
  top: number;
  bottom: number;
  /** y of the top staff line. */
  topLineY: number;
  x0: number;
  x1: number;
  firstMeasure: number;
  lastMeasure: number;
}

export interface PlannedSystem {
  measures: number[];
  widths: number[];
  /** Space needed above / below the stave for ledger lines & stems. */
  above: number;
  below: number;
  height: number;
}

export interface Plan {
  measures: MeasureLayout[];
  systems: PlannedSystem[];
  width: number;
}

interface Built {
  notes: StaveNote[];
  pieces: Piece[];
  voice: Voice;
  beams: Beam[];
  minLine: number;
  maxLine: number;
}

interface Ctx {
  score: Score;
  fifths: number;
  clef: string;
  selection: [number, number] | null;
  ts: string;
}

function makeCtx(score: Score, selection: [number, number] | null): Ctx {
  return {
    score,
    fifths: writtenFifths(score.keyFifths, score.transpose),
    clef: score.clef,
    selection,
    ts: `${score.timeSig.num}/${score.timeSig.den}`,
  };
}

function isWholeMeasureRest(m: MeasureLayout): boolean {
  return m.pieces.length === 1 && m.pieces[0].pitches.length === 0;
}

function buildMeasure(m: MeasureLayout, c: Ctx, prevTied: Set<number>): Built {
  const keyAlt = keyAlterations(c.fifths);
  const state = new Map<string, number>();
  const notes: StaveNote[] = [];
  let minLine = 1;
  let maxLine = 5;
  const wholeRest = isWholeMeasureRest(m);
  for (const p of m.pieces) {
    const selected = !!c.selection && p.eventIndex >= c.selection[0] && p.eventIndex <= c.selection[1];
    let sn: StaveNote;
    if (p.pitches.length === 0) {
      sn = new StaveNote({
        keys: [c.clef === 'bass' ? 'd/3' : 'b/4'],
        duration: wholeRest ? 'wr' : `${p.value.dur}r`,
        dots: wholeRest ? 0 : p.value.dots,
        clef: c.clef,
        align_center: wholeRest,
      });
      if (!wholeRest && p.value.dots) Dot.buildAndAttach([sn], { all: true });
    } else {
      const written = [...p.pitches].sort((a, b) => a - b).map((mm) => ({ midi: mm, s: spell(mm + c.score.transpose, c.fifths) }));
      sn = new StaveNote({
        keys: written.map((w) => `${w.s.letter.toLowerCase()}/${w.s.octave}`),
        duration: p.value.dur,
        dots: p.value.dots,
        clef: c.clef,
        auto_stem: true,
      });
      const continuation = !p.firstOfEvent;
      written.forEach((w, i) => {
        const k = `${w.s.letter}${w.s.octave}`;
        const current = state.has(k) ? state.get(k)! : keyAlt[w.s.letter];
        const tiedIn = continuation || prevTied.has(w.midi);
        if (w.s.alter !== current && !tiedIn) sn.addModifier(new Accidental(ACC_CODE[w.s.alter]), i);
        state.set(k, w.s.alter);
      });
      if (p.value.dots) Dot.buildAndAttach([sn], { all: true });
      for (const kp of sn.getKeyProps()) {
        minLine = Math.min(minLine, kp.line - (kp.line < 3 ? 0 : 3.5));
        maxLine = Math.max(maxLine, kp.line + (kp.line < 3 ? 3.5 : 0));
      }
    }
    if (selected) sn.setStyle({ fillStyle: COLORS.select, strokeStyle: COLORS.select });
    notes.push(sn);
    // Pitches carried into the next piece by a tie don't get a new accidental.
    prevTied.clear();
    const ev = p.eventIndex >= 0 ? c.score.events[p.eventIndex] : undefined;
    if (p.pitches.length && (!p.lastOfEvent || ev?.tieNext)) p.pitches.forEach((x) => prevTied.add(x));
  }
  const [num, den] = c.ts.split('/').map(Number);
  const voice = new Voice({ num_beats: num, beat_value: den }).setMode(Voice.Mode.SOFT);
  voice.addTickables(notes);
  const beams = Beam.generateBeams(notes, { groups: Beam.getDefaultBeamGroups(c.ts) });
  return { notes, pieces: m.pieces, voice, beams, minLine, maxLine };
}

function modifiersWidth(c: Ctx, withTime: boolean): number {
  const s = new Stave(0, 0, 500);
  s.addClef(c.clef).addKeySignature(KEY_SPEC[c.fifths] ?? 'C');
  if (withTime) s.addTimeSignature(c.ts);
  return s.getNoteStartX();
}

/** Decide which measures go on which line for a given page width. */
export function planLayout(score: Score, width: number): Plan {
  const c = makeCtx(score, null);
  const measures = layoutMeasures(score.events, score.timeSig);
  const tied = new Set<number>();
  const natural: number[] = [];
  const lines: { min: number; max: number }[] = [];
  for (const m of measures) {
    const b = buildMeasure(m, c, tied);
    const f = new Formatter().joinVoices([b.voice]);
    const min = f.preCalculateMinTotalWidth([b.voice]);
    natural.push(Math.max(80, min * 1.45 + 34));
    lines.push({ min: b.minLine, max: b.maxLine });
  }
  const modsFirst = modifiersWidth(c, true);
  const modsOther = modifiersWidth(c, false);
  const systems: PlannedSystem[] = [];
  let i = 0;
  while (i < measures.length) {
    const mods = systems.length === 0 ? modsFirst : modsOther;
    const idx: number[] = [];
    let used = mods;
    while (i < measures.length && (idx.length === 0 || used + natural[i] <= width)) {
      used += natural[i];
      idx.push(i);
      i++;
    }
    const isLast = i >= measures.length;
    const sum = idx.reduce((s, k) => s + natural[k], 0);
    const avail = width - mods;
    const stretch = isLast && sum < avail * 0.65 ? 1 : avail / sum;
    const widths = idx.map((k, j) => natural[k] * stretch + (j === 0 ? mods : 0));
    const minLine = Math.min(...idx.map((k) => lines[k].min));
    const maxLine = Math.max(...idx.map((k) => lines[k].max));
    const above = Math.max(0, (maxLine - 9) * LINE) + (systems.length === 0 ? 24 : 0);
    const below = Math.max(0, (-3 - minLine) * LINE);
    systems.push({ measures: idx, widths, above, below, height: above + STAVE_H + below });
  }
  return { measures, systems, width };
}

export interface DrawResult {
  hits: NoteHit[];
  systems: SystemBox[];
}

/**
 * Draw a subset of planned systems into `ctx` starting at `top`.
 * Returns hit boxes for interaction.
 */
export function drawSystems(
  ctx: RenderContext,
  score: Score,
  plan: Plan,
  systemIdx: number[],
  top: number,
  left: number,
  selection: [number, number] | null,
  gap = 8,
): DrawResult {
  const c = makeCtx(score, selection);
  const hits: NoteHit[] = [];
  const boxes: SystemBox[] = [];
  const rendered: { piece: Piece; note: StaveNote; sys: number }[] = [];
  const tied = new Set<number>();
  // Rebuild measures before the first drawn one so accidentals/ties carry correctly.
  let y = top;
  for (const si of systemIdx) {
    const sys = plan.systems[si];
    y += sys.above;
    let x = left;
    let firstStave: Stave | null = null;
    sys.measures.forEach((mi, j) => {
      const m = plan.measures[mi];
      const stave = new Stave(x, y, sys.widths[j]);
      if (j === 0) {
        stave.addClef(c.clef).addKeySignature(KEY_SPEC[c.fifths] ?? 'C');
        if (mi === 0) stave.addTimeSignature(c.ts);
        firstStave = stave;
      }
      if (mi === 0) stave.setTempo({ duration: 'q', bpm: score.tempo }, -14 - Math.max(0, sys.above - 24));
      if (mi > 0 && j === 0) stave.setMeasure(mi + 1);
      if (mi === plan.measures.length - 1) stave.setEndBarType(3 /* END */);
      stave.setContext(ctx).draw();
      const b = buildMeasure(m, c, tied);
      new Formatter().joinVoices([b.voice]).formatToStave([b.voice], stave);
      b.voice.draw(ctx, stave);
      b.beams.forEach((bm) => bm.setContext(ctx).draw());
      b.notes.forEach((n, k) => {
        const piece = b.pieces[k];
        rendered.push({ piece, note: n, sys: si });
        const bb = n.getBoundingBox();
        if (piece.eventIndex >= 0 && bb) {
          hits.push({ eventIndex: piece.eventIndex, x: bb.getX(), y: bb.getY(), w: bb.getW(), h: bb.getH(), system: si });
        }
      });
      x += sys.widths[j];
    });
    const fs = firstStave as Stave | null;
    boxes.push({
      top: y - sys.above,
      bottom: y + STAVE_H + sys.below,
      topLineY: fs ? fs.getYForLine(0) : y + 40,
      x0: left,
      x1: x,
      firstMeasure: sys.measures[0],
      lastMeasure: sys.measures[sys.measures.length - 1],
    });
    y += STAVE_H + sys.below + gap;
  }
  drawTies(ctx, score, rendered);
  return { hits, systems: boxes };
}

function drawTies(ctx: RenderContext, score: Score, rendered: { piece: Piece; note: StaveNote; sys: number }[]) {
  for (let i = 0; i < rendered.length - 1; i++) {
    const a = rendered[i];
    const b = rendered[i + 1];
    if (!a.piece.pitches.length || !b.piece.pitches.length) continue;
    let common: number[] = [];
    if (a.piece.eventIndex === b.piece.eventIndex && a.piece.eventIndex >= 0) common = a.piece.pitches;
    else if (a.piece.lastOfEvent && a.piece.eventIndex >= 0 && score.events[a.piece.eventIndex]?.tieNext) {
      common = a.piece.pitches.filter((p) => b.piece.pitches.includes(p));
    }
    if (!common.length) continue;
    const sortedA = [...a.piece.pitches].sort((x, y) => x - y);
    const sortedB = [...b.piece.pitches].sort((x, y) => x - y);
    const ai = common.map((p) => sortedA.indexOf(p));
    const bi = common.map((p) => sortedB.indexOf(p));
    if (a.sys === b.sys) {
      new StaveTie({ first_note: a.note, last_note: b.note, first_indices: ai, last_indices: bi }).setContext(ctx).draw();
    } else {
      new StaveTie({ first_note: a.note, last_note: null, first_indices: ai, last_indices: ai }).setContext(ctx).draw();
      new StaveTie({ first_note: null, last_note: b.note, first_indices: bi, last_indices: bi }).setContext(ctx).draw();
    }
  }
}

export interface ScoreRender extends DrawResult {
  height: number;
  svg: SVGSVGElement;
}

/** Render the whole score as one continuous SVG (editor view). */
export function renderScoreInto(
  host: HTMLDivElement,
  score: Score,
  width: number,
  selection: [number, number] | null,
  margin = 24,
): ScoreRender {
  host.innerHTML = '';
  const plan = planLayout(score, width - margin * 2);
  const height = plan.systems.reduce((s, sy) => s + sy.height + 8, 0) + margin * 2;
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  const res = drawSystems(ctx, score, plan, plan.systems.map((_, i) => i), margin, margin, selection);
  const svg = host.querySelector('svg') as SVGSVGElement;
  return { ...res, height, svg };
}
