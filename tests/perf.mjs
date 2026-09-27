// Rough performance probe (dev server): frame time, draw calls and triangles per chapter.
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--window-size=1440,900'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('.loading.done'));
for (const p of [0, 1.85, 2.6, 3.9, 4.5, 6.1, 7.1, 8.66]) {
  await page.evaluate(p => window.scrollTo(0, (p / 9.4) * (document.documentElement.scrollHeight - innerHeight)), p);
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => new Promise(resolve => {
    const times = [];
    let last = performance.now();
    const tick = now => {
      times.push(now - last);
      last = now;
      if (times.length < 120) requestAnimationFrame(tick);
      else {
        const gl = window.__calibre.r3f().gl;
        times.sort((a, b) => a - b);
        resolve({ median: times[60].toFixed(1), p95: times[114].toFixed(1), calls: gl.info.render.calls, tris: gl.info.render.triangles, quality: window.__calibre.story.quality });
      }
    };
    requestAnimationFrame(tick);
  }));
  console.log(`p=${p}`, JSON.stringify(r));
}
await browser.close();
