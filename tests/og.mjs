// Renders the social preview image (public/og.png) from the live dev server.
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('.loading.done'));
await page.addStyleTag({ content: '.intro-hint{display:none!important}' });
await page.evaluate(() => {
  const s = window.__calibre.story;
  s.spin.y = -0.35;
  s.spin.x = 0.12;
});
await page.waitForTimeout(2500);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
