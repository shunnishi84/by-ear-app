import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { renderMelody } from '../tests/synth';
import { encodeWav } from '../tests/wav';

const TWINKLE: [number | null, number][] = [
  [67, 1], [67, 1], [74, 1], [74, 1], [76, 1], [76, 1], [74, 2],
  [72, 1], [72, 1], [71, 1], [71, 1], [69, 0.5], [69, 0.5], [71, 0.5], [69, 0.5], [67, 2],
];

async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function transcribeTwinkle(page: Page) {
  const wav = encodeWav(renderMelody(TWINKLE, 96, 22050), 22050);
  await page.getByTestId('open-import').click();
  await page.getByTestId('audio-input').setInputFiles({ name: 'twinkle.wav', mimeType: 'audio/wav', buffer: Buffer.from(wav) });
  await page.getByTestId('run-transcribe').click();
  await expect(page.locator('.modal')).toHaveCount(0, { timeout: 60_000 });
}

test('transcribes a melody, edits it and undoes', async ({ page }) => {
  await fresh(page);
  await transcribeTwinkle(page);
  await expect(page.locator('.toast')).toContainText('♩=96');
  await expect(page.locator('.toast')).toContainText('ト長調');
  await expect(page.locator('.title-input')).toHaveValue('twinkle');

  const info = page.getByTestId('selection-info');
  await page.keyboard.press('ArrowRight');
  await expect(info).toContainText('G4');
  await expect(info).toContainText('4分音符');
  await page.keyboard.press('ArrowUp');
  await expect(info).toContainText('G♯4');
  await page.keyboard.press('Control+z');
  await expect(info).toContainText('G4');
  await page.keyboard.press('6');
  await expect(info).toContainText('2分音符');
  // Next event is now the D (the second G was consumed by the half note).
  await page.keyboard.press('ArrowRight');
  await expect(info).toContainText('D5');
});

test('manual entry with letters and MusicXML export', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: '手で入力する' }).click();
  await page.keyboard.press('5');
  for (const k of ['c', 'd', 'e', 'f']) await page.keyboard.press(k);
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('selection-info')).toContainText('F');

  const dl = page.waitForEvent('download');
  await page.getByTestId('export-menu').click();
  await page.getByRole('button', { name: /MusicXML/ }).click();
  const xml = readFileSync(await (await dl).path(), 'utf8');
  const steps = [...xml.matchAll(/<step>([A-G])<\/step>/g)].map((m) => m[1]);
  expect(steps).toEqual(['C', 'D', 'E', 'F']);
});

test('clicking a selected note moves it to the clicked line', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: '手で入力する' }).click();
  await page.keyboard.press('5');
  await page.keyboard.press('b');
  await page.keyboard.press('ArrowLeft');
  const info = page.getByTestId('selection-info');
  await expect(info).toContainText('B4');
  const note = page.locator('.score-host svg .vf-stavenote').first();
  const box = (await note.boundingBox())!;
  // Clicking one staff step (5px) lower on the selected note -> A4.
  const head = page.locator('.score-host svg .vf-notehead').first();
  const hb = (await head.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, hb.y + hb.height / 2 + 5);
  await expect(info).toContainText('A4');
});

test('plays with a moving cursor and exports a PDF', async ({ page }) => {
  await fresh(page);
  await transcribeTwinkle(page);
  await page.getByTestId('play').click();
  await expect(page.locator('.play-cursor')).toBeVisible();
  await page.getByTestId('play').click();
  await expect(page.locator('.play-cursor')).toHaveCount(0);

  const dl = page.waitForEvent('download');
  await page.getByTestId('export-menu').click();
  await page.getByTestId('export-pdf').click();
  const pdf = readFileSync(await (await dl).path());
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(5000);
});
