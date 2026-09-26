import { Renderer } from 'vexflow/bravura';
import { drawSystems, planLayout } from '../render/renderScore';
import { keyNameJa } from '../model/theory';
import type { Score } from '../model/types';

// A4 at 96 dpi in CSS px, and in PDF points.
const PAGE_W = 794;
const PAGE_H = 1123;
const PT_W = 595.28;
const PT_H = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 64;
const HEADER_H = 110;
const SYSTEM_GAP = 16;

/** Title block drawn on a canvas so Japanese text needs no embedded PDF font. */
function headerImage(score: Score, width: number): string {
  const scale = 3;
  const c = document.createElement('canvas');
  c.width = width * scale;
  c.height = HEADER_H * scale;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.scale(scale, scale);
  g.fillStyle = '#000';
  g.textBaseline = 'alphabetic';
  const sans = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
  g.textAlign = 'center';
  g.font = `bold 26px ${sans}`;
  g.fillText(score.title || '無題', width / 2, 40, width);
  g.font = `13px ${sans}`;
  g.textAlign = 'right';
  if (score.composer) g.fillText(score.composer, width, 72);
  g.textAlign = 'left';
  const info: string[] = [keyNameJa(score.keyFifths, score.keyMode)];
  if (score.transpose === 2) info.push('in B♭');
  else if (score.transpose === -3 || score.transpose === 9) info.push('in E♭');
  else if (score.transpose === 7) info.push('in F');
  g.fillText(info.join('  '), 0, 72);
  return c.toDataURL('image/png');
}

/** Render the score to a multi-page A4 PDF and return it as a Blob. */
export async function exportPdf(score: Score): Promise<Blob> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const contentW = PAGE_W - MARGIN_X * 2;
  const plan = planLayout(score, contentW);

  // Paginate systems.
  const pages: number[][] = [[]];
  let y = MARGIN_TOP + HEADER_H;
  plan.systems.forEach((s, i) => {
    const h = s.height + SYSTEM_GAP;
    if (y + h > PAGE_H - MARGIN_BOTTOM && pages[pages.length - 1].length) {
      pages.push([]);
      y = MARGIN_TOP;
    }
    pages[pages.length - 1].push(i);
    y += h;
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({ title: score.title, author: score.composer, creator: 'By Ear' });
  const k = PT_W / PAGE_W;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;';
  document.body.appendChild(host);
  try {
    for (let p = 0; p < pages.length; p++) {
      if (p > 0) doc.addPage('a4', 'portrait');
      host.innerHTML = '';
      const renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(PAGE_W, PAGE_H);
      const ctx = renderer.getContext();
      const top = p === 0 ? MARGIN_TOP + HEADER_H : MARGIN_TOP;
      drawSystems(ctx, score, plan, pages[p], top, MARGIN_X, null, SYSTEM_GAP);
      const svg = host.querySelector('svg')!;
      // svg2pdf only knows the standard PDF fonts and plain px sizes; VexFlow
      // writes e.g. font-family="Times New Roman, serif" font-size="14pt".
      svg.querySelectorAll('text').forEach((t) => {
        t.setAttribute('font-family', 'times');
        const size = t.getAttribute('font-size') ?? '';
        const pt = /^([\d.]+)pt$/.exec(size);
        if (pt) t.setAttribute('font-size', String((Number(pt[1]) * 96) / 72));
      });
      await doc.svg(svg, { x: 0, y: 0, width: PT_W, height: PT_H });
      if (p === 0) doc.addImage(headerImage(score, contentW), 'PNG', MARGIN_X * k, MARGIN_TOP * k, contentW * k, HEADER_H * k, undefined, 'FAST');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`${p + 1} / ${pages.length}`, PT_W / 2, PT_H - 28, { align: 'center' });
    }
  } finally {
    host.remove();
  }
  return doc.output('blob');
}
