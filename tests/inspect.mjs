// Dev-only visual inspection: pause the machine and frame a region from above.
// Usage: node tests/inspect.mjs <outDir> <name> <cx,cy,cz> <dist> <times...>
import { chromium } from 'playwright';
const [out, name, centre, dist = '1.6', ...times] = process.argv.slice(2);
const [cx, cy, cz] = centre.split(',').map(Number);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /^Explore/ }).click();
await page.waitForTimeout(800);
for (const t of times.length ? times : ['0']) {
  await page.evaluate(({ cx, cy, cz, d, t }) => {
    const { story, camera, controls, scene } = window.__calibre;
    const hide = ['dial', 'hour', 'minute', 'second', 'trainBridge', 'palletCock', 'balanceCock', 'barrelBridge', 'screws', 'jewel', 'case', 'bezel', 'crystal'];
    scene.traverse(o => { if (hide.includes(o.name)) o.scale.set(0, 0, 0); });
    story.controls = { ...story.controls, playing: false, explode: 0, labels: false };
    story.time = 36000 + Number(t);
    camera.up.set(0, 1, 0);
    camera.position.set(cx, cy, cz + Number(d));
    if (controls) { controls.target.set(cx, cy, cz); controls.update(); }
    camera.lookAt(cx, cy, cz);
  }, { cx, cy, cz, d: dist, t });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-${t}.png` });
}
console.log(errors.length ? errors.join('\n') : 'ok');
await browser.close();
