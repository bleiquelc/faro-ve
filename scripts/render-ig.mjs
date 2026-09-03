// Temp: renderiza las láminas IG (scratchpad) a PNG 1080x1350 con Playwright.
import { chromium } from '@playwright/test';

const dir =
  '/private/tmp/claude-501/-Users-bleiquelcolina-Desktop-faro-ve/94032d53-0702-46e8-b0eb-32c902648701/scratchpad/ig';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 1
});
await page.goto('file://' + dir + '/faro-ig.html', { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
});
await page.waitForTimeout(600);

for (const id of ['s1', 's2', 's3', 's4', 's5']) {
  const el = await page.$('#' + id);
  await el.screenshot({ path: `${dir}/faro-ig-${id}.png` });
  console.log('saved', id);
}
await browser.close();
console.log('done');
