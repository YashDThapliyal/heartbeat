// End-to-end smoke test against the dev server (uses the dev-only __calibre bridge).
// Usage: node tests/smoke.mjs [outDir]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const out = process.argv[2] ?? 'shots';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${e.message}`);
  }
};

async function open(viewport) {
  const page = await browser.newPage({ viewport });
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.loading.done'), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  return page;
}

const scrollToP = (page, p) =>
  page.evaluate(p => window.scrollTo(0, (p / 9.75) * (document.documentElement.scrollHeight - innerHeight)), p);
const story = (page, expr) => page.evaluate(new Function(`const s = window.__calibre.story; return (${expr});`));

const page = await open({ width: 1440, height: 900 });

await check('intro shows the watch alone with a scroll hint, then the landing copy', async () => {
  assert.equal(await page.locator('.copy').count(), 0, 'no copy on the intro');
  assert.ok(await page.locator('.intro-pill').isVisible());
  assert.equal(await page.locator('.chapter-nav').isVisible(), false, 'navigator hidden on intro');
  await scrollToP(page, 0.35);
  await page.waitForTimeout(2200);
  assert.equal(await page.locator('.copy h1').innerText().then(t => t.startsWith('Seventeen')), true);
  assert.equal(await page.locator('.chapter-nav').isVisible(), false, 'navigator still hidden on landing');
});

await check('the watch can be dragged to turn on the intro, and settles back once the story begins', async () => {
  await scrollToP(page, 0);
  await page.waitForTimeout(1500);
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(900, 470, { steps: 12 });
  await page.mouse.up();
  const turned = await story(page, 's.spin.y');
  assert.ok(turned > 0.8, `drag turned the watch (spin.y=${turned.toFixed(2)})`);
  await scrollToP(page, 2.95);
  await page.waitForTimeout(3000);
  const settled = await story(page, 'Math.abs(s.spin.y - Math.round(s.spin.y / (2 * Math.PI)) * 2 * Math.PI) + Math.abs(s.spin.x)');
  assert.ok(settled < 0.02, `watch returned to its pose (${settled.toFixed(3)})`);
  await scrollToP(page, 0.35);
  await page.waitForTimeout(2200);
});

await check('clicking the watch opens it', async () => {
  await scrollToP(page, 0);
  await page.waitForTimeout(1800);
  assert.ok((await page.locator('.intro-pill').innerText()).toLowerCase().includes('click'));
  await page.mouse.click(720, 400);
  await page.waitForTimeout(3500);
  const mid = await story(page, 's.p');
  assert.ok(mid > 0.5 && mid < 2.0, `still opening, deliberately (p=${mid.toFixed(2)})`);
  await page.waitForTimeout(5500);
  const p = await story(page, 's.p');
  assert.ok(Math.abs(p - 2.17) < 0.1, `opened to p=${p.toFixed(2)}`);
  assert.ok((await story(page, 's.frame.open.dial')) > 0.99, 'dial lifted away');
  await scrollToP(page, 0);
  await page.waitForTimeout(2200);
});

await check('a short scroll from the opening glides on to the landing', async () => {
  await scrollToP(page, 0);
  await page.waitForTimeout(1500);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(2200);
  const p = await story(page, 's.targetP');
  assert.ok(p > 0.33 && p < 0.4, `landed at p=${p.toFixed(2)}`);
});

await check('guided tour plays, holds at stops, and yields to the viewer', async () => {
  await page.locator('.play-tour').click();
  await page.waitForTimeout(500);
  await page.waitForTimeout(6500);
  const p1 = await story(page, 's.targetP');
  assert.ok(p1 > 0.5, `tour advanced (p=${p1.toFixed(2)})`);
  await page.waitForTimeout(5000);
  const p2 = await story(page, 's.targetP');
  assert.ok(p2 > p1, 'still advancing');
  assert.ok(await page.locator('.tour-button.playing').isVisible(), 'masthead shows pause');
  assert.ok(await page.locator('.tour-bar').isVisible(), 'tour bar shows');
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1500);
  const p3 = await story(page, 's.targetP');
  await page.waitForTimeout(1500);
  const p4 = await story(page, 's.targetP');
  assert.ok(Math.abs(p4 - p3) < 0.01, 'tour stopped after user scrolled');
  assert.equal(await page.locator('.tour-button.playing').count(), 0);
  await scrollToP(page, 0);
  await page.waitForTimeout(2000);
});

await check('wind it yourself: holding the button winds the mainspring', async () => {
  await scrollToP(page, 3.9);
  await page.waitForTimeout(2200);
  assert.ok((await story(page, 's.frame.wind')) < 0.1, 'starts let down');
  const button = page.locator('.hold-button');
  await button.hover();
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  const w = await story(page, 's.frame.wind');
  assert.ok(w > 0.5, `wound to ${w.toFixed(2)}`);
  await page.screenshot({ path: `${out}/wind.png` });
  await button.hover();
  await page.mouse.down();
  await page.waitForTimeout(1600);
  await page.mouse.up();
  assert.ok(await page.locator('.hold-button.done').isVisible(), 'shows fully wound as a status');
  await page.screenshot({ path: `${out}/wound.png` });
  await page.waitForTimeout(6000);
  const p = await story(page, 's.p');
  assert.ok(p > 4.4, `carried on to the gear train by itself (p=${p.toFixed(2)})`);
});

await check('tick it yourself: a slow-motion walkthrough, then each Space press plays one beat', async () => {
  await scrollToP(page, 6.45);
  await page.waitForTimeout(3200);
  assert.equal(await story(page, 's.interact.tick.demo.state'), 'playing', 'walkthrough is playing');
  await page.waitForTimeout(3600);
  await page.screenshot({ path: `${out}/tick-demo.png` });
  // Let the walkthrough finish, then take a turn.
  await page.waitForTimeout(6000);
  assert.equal(await story(page, 's.interact.tick.demo.state'), 'done');
  await page.screenshot({ path: `${out}/tick-turn.png` });
  const a0 = await story(page, 's.mech.angles.escape');
  await page.keyboard.press('Space');
  await page.waitForTimeout(1600);
  const a1 = await story(page, 's.mech.angles.escape');
  const half = Math.PI / 15;
  assert.ok(Math.abs(a1 - a0 - half) < 1e-6, `advanced ${(a1 - a0).toFixed(4)} vs ${half.toFixed(4)}`);
  assert.equal(await story(page, 's.interact.tick.count'), 1);
  assert.ok(/tap for (tick|tock)/i.test(await page.locator('.tick-button').innerText()), 'button offers the next beat');
});

await check('chapter links: the address follows the story', async () => {
  const hash = await page.evaluate(() => location.hash);
  assert.equal(hash, '#escapement');
});

await check('five-ideas overview and escapement explainer render', async () => {
  await scrollToP(page, 2.95);
  await page.waitForTimeout(2200);
  assert.equal(await page.locator('.ideas li').count(), 5);
  await scrollToP(page, 6.45);
  await page.waitForTimeout(2200);
  assert.equal(await page.locator('.steps li.active').count(), 1);
  assert.ok(await page.locator('.tick-button').isVisible());
  assert.ok((await page.locator('.callout small').first().innerText()).length > 15, 'explanation sits on the mechanism');
  await scrollToP(page, 0);
  await page.waitForTimeout(2200);
});

await check('scrolling forward drives the story; scrolling back reverses it', async () => {
  await scrollToP(page, 6.45);
  await page.waitForTimeout(2500);
  assert.ok((await story(page, 's.p')) > 6.35);
  assert.ok((await story(page, 's.frame.timeScale')) < 0.1, 'slow motion in escapement');
  await scrollToP(page, 2.95);
  await page.waitForTimeout(2500);
  const p = await story(page, 's.p');
  assert.ok(p > 2.85 && p < 3.05, `p=${p}`);
  assert.ok((await story(page, 's.frame.explode')) > 0.99, 'exploded again after scrolling back');
  await scrollToP(page, 0);
  await page.waitForTimeout(2500);
  assert.equal(await story(page, 's.frame.open.dial'), 0);
});

await check('escape wheel advances intermittently in the escapement chapter', async () => {
  await scrollToP(page, 6.45);
  await page.waitForTimeout(2500);
  const samples = [];
  for (let i = 0; i < 120; i++) {
    samples.push(await story(page, 's.mech.angles.escape'));
    await page.waitForTimeout(90);
  }
  const deltas = samples.slice(1).map((v, i) => v - samples[i]);
  assert.ok(deltas.some(d => Math.abs(d) < 1e-9), 'has stationary frames');
  assert.ok(deltas.some(d => d > 1e-4), 'has advancing frames');
  assert.ok(deltas.every(d => d >= -1e-9), 'never reverses');
});

await check('chapter navigator and arrow keys jump between chapters', async () => {
  await scrollToP(page, 0);
  await page.waitForTimeout(2500);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(2500);
  assert.ok(Math.abs((await story(page, 's.p')) - 2.17) < 0.1, 'ArrowRight goes to the next chapter');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(2500);
  assert.ok((await story(page, 's.p')) < 0.1, 'ArrowLeft goes back');
  assert.equal(await page.locator('.chapter-nav').isVisible(), false, 'navigator stays out of the intro');
  await scrollToP(page, 2.95);
  await page.waitForTimeout(2200);
  await page.locator('.nav-stop button').nth(4).click();
  await page.waitForTimeout(3000);
  const p = await story(page, 's.p');
  assert.ok(Math.abs(p - 4.65) < 0.1, `p=${p}`);
});

await check('explore mode: enter, orbit controls, speed, pause, explode, labels', async () => {
  await page.getByRole('button', { name: /^Explore/ }).click();
  await page.waitForTimeout(1200);
  assert.equal(await story(page, 's.explore'), true);
  assert.equal(await page.evaluate(() => Boolean(window.__calibre.controls)), true, 'OrbitControls mounted');
  await page.getByRole('button', { name: '0.25×' }).click();
  assert.equal(await story(page, 's.controls.speed'), 0.25);
  await page.getByRole('button', { name: /Pause/ }).click();
  const t0 = await story(page, 's.time');
  await page.waitForTimeout(500);
  assert.equal(await story(page, 's.time'), t0, 'paused clock stands still');
  await page.getByRole('button', { name: /Play/ }).click();
  await page.locator('.explode input').fill('0.9');
  await page.waitForTimeout(1200);
  assert.equal(await story(page, 's.controls.explode'), 0.9);
  await page.screenshot({ path: `${out}/explore-exploded.png` });
  await page.getByRole('button', { name: /Labels/ }).click();
  assert.equal(await story(page, 's.controls.labels'), false);
});

await check('explore mode: selecting a part by click and by index', async () => {
  await page.locator('.explode input').fill('0.35');
  await page.waitForTimeout(800);
  await page.mouse.click(720, 450);
  await page.waitForTimeout(500);
  const clicked = await story(page, 's.selected');
  await page.locator('.part-index select').selectOption('balance');
  await page.waitForTimeout(900);
  assert.equal(await story(page, 's.selected'), 'balance');
  assert.equal(await page.locator('.part-card h2').innerText(), 'Balance wheel');
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => {
    const { camera, controls } = window.__calibre.r3f();
    return camera.position.distanceTo(controls.target);
  });
  assert.ok(d < 6, `camera flew in (distance ${d.toFixed(2)})`);
  await page.screenshot({ path: `${out}/explore-selected.png` });
  results.push(`info click at centre selected: ${clicked}`);
});

await check('explore mode: reset and exit restore the story', async () => {
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.waitForTimeout(500);
  assert.equal(await story(page, 's.selected'), null);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  assert.equal(await story(page, 's.explore'), false);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-exploring')), false);
  assert.ok(await page.locator('.chapter-nav').isVisible());
});

await page.close();

const mobile = await open({ width: 390, height: 844 });
await check('mobile: story renders and scrolls', async () => {
  for (const p of [0, 0.35, 2.2, 4.65, 6.45, 9.75]) {
    await scrollToP(mobile, p);
    await mobile.waitForTimeout(2200);
    await mobile.screenshot({ path: `${out}/mobile-${p}.png` });
  }
  assert.ok((await story(mobile, 's.portrait')) === true);
});
await mobile.close();

console.log(results.join('\n'));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
