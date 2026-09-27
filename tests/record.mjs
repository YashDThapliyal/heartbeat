// Records a smooth demo video by driving the page clock frame by frame.
// Usage (dev server running): node tests/record.mjs [outFile] [--preview]
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'media/heartbeat-demo.mp4';
const preview = process.argv.includes('--preview');
const FPS = 30;
const W = 1920;
const H = 1080;
const P_END = 9.75;
const frames = 'media/.frames';

rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.clock.install();
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 120 && !(await page.evaluate(() => Boolean(document.querySelector('.loading.done')))); i++) {
  await page.clock.runFor(100);
  await page.waitForTimeout(20);
}
await page.clock.runFor(1500);
await page.addStyleTag({
  content: `#demo-cursor{position:fixed;z-index:9999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
    background:rgba(255,255,255,.9);box-shadow:0 0 0 1px rgba(0,0,0,.35),0 2px 10px rgba(0,0,0,.5);pointer-events:none;
    transition:transform .15s;opacity:0}
    #demo-cursor.down{transform:scale(.72)}`,
});
await page.evaluate(() => {
  const c = document.createElement('div');
  c.id = 'demo-cursor';
  document.body.appendChild(c);
});

let n = 0;
async function frame() {
  await page.clock.runFor(1000 / FPS);
  await page.screenshot({ path: `${frames}/${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
}
async function hold(seconds) {
  const count = Math.round((preview ? seconds / 3 : seconds) * FPS);
  for (let i = 0; i < count; i++) await frame();
}
const ease = t => t * t * (3 - 2 * t);
const scrollTo = p =>
  page.evaluate(p => window.scrollTo({ top: (p / 9.75) * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }), p);
async function travel(from, to, seconds) {
  const count = Math.max(1, Math.round((preview ? seconds / 3 : seconds) * FPS));
  for (let i = 1; i <= count; i++) {
    await scrollTo(from + (to - from) * ease(i / count));
    await frame();
  }
}
const cursor = (x, y, visible = true, down = false) =>
  page.evaluate(
    ({ x, y, visible, down }) => {
      const c = document.getElementById('demo-cursor');
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      c.style.opacity = visible ? '1' : '0';
      c.classList.toggle('down', down);
    },
    { x, y, visible, down },
  );
async function moveCursor(x0, y0, x1, y1, seconds, down = false) {
  const count = Math.round((preview ? seconds / 3 : seconds) * FPS);
  for (let i = 1; i <= count; i++) {
    const t = ease(i / count);
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    await cursor(x, y, true, down);
    await page.mouse.move(x, y);
    await frame();
  }
}
const story = expr => page.evaluate(new Function(`const s = window.__calibre.story; return (${expr});`));

// 1. The watch alone. A lazy turn by hand.
await hold(1.5);
await moveCursor(1500, 820, 980, 560, 1.0);
await page.mouse.down();
await cursor(980, 560, true, true);
await moveCursor(980, 560, 1050, 568, 1.4, true);
await page.mouse.up();
await cursor(1050, 568, true, false);
await hold(1.6);

// 2. Click the watch: it opens piece by piece.
await moveCursor(1050, 568, 960, 520, 0.6);
await cursor(960, 520, true, true);
await page.mouse.click(960, 520);
await hold(0.15);
await cursor(960, 520, false);
await hold(8.2);

// 3. The five ideas, over the exploded movement.
const here = await story('s.p');
await travel(here, 2.95, 2.6);
await hold(2.4);

// 4. Wind it: the crown glows; hold to wind until the mainspring is full.
await travel(2.95, 3.95, 3.0);
await hold(2.4);
await page.evaluate(() => {
  window.__calibre.story.interact.windHeld = true;
});
await hold(2.6);
await page.evaluate(() => {
  window.__calibre.story.interact.windHeld = false;
});
// It carries on into the gear train by itself.
await hold(3.2);

// 5. Follow the energy through the train.
const trainAt = await story('s.p');
await travel(trainAt, 5.55, 5.5);
await hold(0.8);

// 6. The escapement: the slow-motion walkthrough, then tick and tock by hand.
await travel(5.55, 6.45, 2.4);
await hold(10.6);
for (let i = 0; i < 2; i++) {
  await page.keyboard.press('Space');
  await hold(1.6);
}
await hold(0.6);

// 7. The balance, then reassembly back to the watch.
await travel(6.45, 7.4, 2.2);
await hold(2.2);
await travel(7.4, P_END, 6.5);
await hold(2.5);

await browser.close();

mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true });
execFileSync(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${frames}/%05d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  { stdio: 'inherit' },
);
rmSync(frames, { recursive: true, force: true });
console.log(`${n} frames → ${out} (${(n / FPS).toFixed(1)} s)`);
