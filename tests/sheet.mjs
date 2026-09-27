// Compose screenshots into contact sheets: node tests/sheet.mjs <dir> [perSheet=6]
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
const [dir, per = '6'] = process.argv.slice(2);
const files = readdirSync(dir).filter(f => /^p.*\.png$/.test(f)).sort((a, b) => parseFloat(a.slice(1)) - parseFloat(b.slice(1)));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1350 } });
for (let i = 0; i < files.length; i += Number(per)) {
  const chunk = files.slice(i, i + Number(per));
  const cells = chunk.map(f => `<figure><img src="data:image/png;base64,${readFileSync(`${dir}/${f}`).toString('base64')}"><figcaption>${f}</figcaption></figure>`).join('');
  await page.setContent(`<style>body{margin:0;background:#222;display:grid;grid-template-columns:1fr 1fr;gap:4px}figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;top:4px;left:6px;color:#ff0;font:14px monospace}</style>${cells}`);
  await page.screenshot({ path: `${dir}/sheet-${i / Number(per)}.png`, fullPage: true });
}
await browser.close();
