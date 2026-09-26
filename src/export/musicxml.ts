import { layoutMeasures } from '../model/layout';
import { keyAlterations, spell, writtenFifths } from '../model/theory';
import { TPQ } from '../model/types';
import type { Score } from '../model/types';

const TYPE: Record<string, string> = { w: 'whole', h: 'half', q: 'quarter', '8': 'eighth', '16': '16th', '32': '32nd' };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** MusicXML 3.1 (partwise) — importable by flat.io, MuseScore, Finale, Dorico… */
export function toMusicXML(score: Score): string {
  const fifths = writtenFifths(score.keyFifths, score.transpose);
  const keyAlt = keyAlterations(fifths);
  const measures = layoutMeasures(score.events, score.timeSig);
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  out.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
  out.push('<score-partwise version="3.1">');
  out.push(`  <work><work-title>${esc(score.title)}</work-title></work>`);
  out.push('  <identification>');
  if (score.composer) out.push(`    <creator type="composer">${esc(score.composer)}</creator>`);
  out.push('    <encoding><software>By Ear (耳コピ)</software></encoding>');
  out.push('  </identification>');
  out.push('  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>');
  out.push('  <part id="P1">');
  let prevTied = new Set<number>();
  measures.forEach((m, mi) => {
    out.push(`    <measure number="${mi + 1}">`);
    if (mi === 0) {
      out.push('      <attributes>');
      out.push(`        <divisions>${TPQ}</divisions>`);
      out.push(`        <key><fifths>${fifths}</fifths><mode>${score.keyMode}</mode></key>`);
      out.push(`        <time><beats>${score.timeSig.num}</beats><beat-type>${score.timeSig.den}</beat-type></time>`);
      out.push(score.clef === 'bass' ? '        <clef><sign>F</sign><line>4</line></clef>' : '        <clef><sign>G</sign><line>2</line></clef>');
      if (score.transpose) {
        const chrom = -score.transpose;
        const diat = Math.round((chrom * 7) / 12);
        out.push(`        <transpose><diatonic>${diat}</diatonic><chromatic>${chrom}</chromatic></transpose>`);
      }
      out.push('      </attributes>');
      out.push('      <direction placement="above"><direction-type><metronome>');
      out.push(`        <beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute>`);
      out.push(`      </metronome></direction-type><sound tempo="${score.tempo}"/></direction>`);
    }
    const state = new Map<string, number>();
    for (const p of m.pieces) {
      const ev = p.eventIndex >= 0 ? score.events[p.eventIndex] : undefined;
      const tieOut = p.pitches.length > 0 && (!p.lastOfEvent || !!ev?.tieNext);
      const nextEv = p.eventIndex >= 0 ? score.events[p.eventIndex + 1] : undefined;
      const dots = p.value.dots ? '<dot/>' : '';
      if (p.pitches.length === 0) {
        out.push(`      <note><rest/><duration>${p.value.ticks}</duration><voice>1</voice><type>${TYPE[p.value.dur]}</type>${dots}</note>`);
        prevTied = new Set();
        continue;
      }
      const sorted = [...p.pitches].sort((a, b) => a - b);
      const nowTied = new Set<number>();
      sorted.forEach((midi, i) => {
        const s = spell(midi + score.transpose, fifths);
        const k = `${s.letter}${s.octave}`;
        const cur = state.has(k) ? state.get(k)! : keyAlt[s.letter];
        const tieIn = !p.firstOfEvent || prevTied.has(midi);
        const tiesOut = tieOut && (!p.lastOfEvent || !!nextEv?.pitches.includes(midi));
        let acc = '';
        if (s.alter !== cur && !tieIn) {
          acc = `<accidental>${({ [-2]: 'flat-flat', [-1]: 'flat', 0: 'natural', 1: 'sharp', 2: 'double-sharp' } as Record<number, string>)[s.alter]}</accidental>`;
        }
        state.set(k, s.alter);
        const ties = `${tieIn ? '<tie type="stop"/>' : ''}${tiesOut ? '<tie type="start"/>' : ''}`;
        const tied = `${tieIn ? '<tied type="stop"/>' : ''}${tiesOut ? '<tied type="start"/>' : ''}`;
        const alter = s.alter ? `<alter>${s.alter}</alter>` : '';
        out.push(
          `      <note>${i > 0 ? '<chord/>' : ''}<pitch><step>${s.letter}</step>${alter}<octave>${s.octave}</octave></pitch>` +
            `<duration>${p.value.ticks}</duration>${ties}<voice>1</voice><type>${TYPE[p.value.dur]}</type>${dots}${acc}` +
            `${tied ? `<notations>${tied}</notations>` : ''}</note>`,
        );
        if (tiesOut) nowTied.add(midi);
      });
      prevTied = nowTied;
    }
    if (mi === measures.length - 1) out.push('      <barline location="right"><bar-style>light-heavy</bar-style></barline>');
    out.push('    </measure>');
  });
  out.push('  </part>');
  out.push('</score-partwise>');
  return out.join('\n');
}
