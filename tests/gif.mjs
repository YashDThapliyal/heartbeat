// Records a seamless looping GIF: the assembled watch explodes into its parts,
// hangs there, then reassembles. Usage (dev server running): node tests/gif.mjs [outFile]
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = process.argv[2] ?? 'media/heartbeat-explode.gif';
const FPS = 20;
const SIZE = 1080;
const GIF_SIZE = 720;
const frames = 'media/.gif-frames';
const P_END = 9.75;
/** Page progress of the exploded "poster" composition in the finale. */
const POSTER = 9.01;

rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.clock.install();
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 120 && !(await page.evaluate(() => Boolean(document.querySelector('.loading.done')))); i++) {
  await page.clock.runFor(100);
  await page.waitForTimeout(20);
}
// Just the watch: no interface.
await page.addStyleTag({
  content: '.masthead,.chapter-nav,.copy,.labels,.intro-hint,.tour-bar,.scrim{display:none!important}',
});
// Freeze the idle sway and gliding reflections, so the last frame matches the first.
const freezeDrift = () =>
  page.evaluate(() => {
    window.__calibre.story.elapsed = 0;
  });

const scrollTo = p =>
  page.evaluate(p => window.scrollTo({ top: (p / 9.75) * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }), p);
await scrollTo(P_END);
for (let i = 0; i < 40; i++) {
  await freezeDrift();
  await page.clock.runFor(100);
}

let n = 0;
async function frame() {
  await freezeDrift();
  await page.clock.runFor(1000 / FPS);
  await page.screenshot({ path: `${frames}/${String(n++).padStart(5, '0')}.png` });
}
async function hold(seconds) {
  for (let i = 0; i < Math.round(seconds * FPS); i++) await frame();
}
const ease = t => t * t * (3 - 2 * t);
async function travel(from, to, seconds) {
  const count = Math.round(seconds * FPS);
  for (let i = 1; i <= count; i++) {
    await scrollTo(from + (to - from) * ease(i / count));
    await frame();
  }
}

await hold(0.25);
await travel(P_END, POSTER, 2.6);
await hold(1.4);
await travel(POSTER, P_END, 3.2);
// Let the scene settle fully onto the opening pose so the loop is seamless.
await hold(0.35);
await browser.close();

const palette = `${frames}/palette.png`;
const scale = `fps=${FPS},scale=${GIF_SIZE}:-1:flags=lanczos`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${frames}/%05d.png`, '-vf', `${scale},palettegen=max_colors=256:stats_mode=full`, palette]);
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${frames}/%05d.png`, '-i', palette,
  '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=sierra2_4a`, '-loop', '0', out,
]);
// An MP4 twin: X converts GIFs to video anyway, and this one is sharper.
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${frames}/%05d.png`,
  '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out.replace(/\.gif$/, '.mp4'),
]);
rmSync(frames, { recursive: true, force: true });
console.log(`${n} frames → ${out} (${(n / FPS).toFixed(1)} s)`);
