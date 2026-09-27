// Visual QA helper: captures frames along the scroll story.
// Usage: node tests/shoot.mjs <url> <outDir> [p1,p2,...] [width]x[height]
import { chromium } from 'playwright';
const [url = 'http://localhost:5173', out = 'shots', list, dims = '1440x900'] = process.argv.slice(2);
const [width, height] = dims.split('x').map(Number);
const points = (list ?? '0,1.0,1.82,2.6,3.55,3.95,4.35,4.9,5.25,6.1,7.05,7.95,8.66,9.4').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
for (const p of points) {
  await page.evaluate(p => window.__watchStory?.jump?.(p) ?? window.scrollTo(0, p / 9.75 * (document.documentElement.scrollHeight - innerHeight)), p);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/p${String(p).padStart(4, '0')}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
