import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFrame, sampleFrame, HERO_SHOT } from '../src/animation/timeline';
import { P_END, INTRO, CHAPTERS, COPY, copyAt, chapterIndexAt } from '../src/animation/chapters';

test('the finale returns exactly to the landing composition, fully assembled', () => {
  const end = sampleFrame(P_END, createFrame());
  const start = sampleFrame(INTRO, createFrame());
  assert.deepEqual(end.shot, start.shot);
  assert.deepEqual([...end.shot.camera], [...HERO_SHOT.camera]);
  assert.equal(end.explode, 0);
  for (const g of ['glass', 'bezel', 'hands', 'dial', 'case'] as const) {
    assert.equal(end.open[g], 0, `${g} closed`);
    assert.equal(end.stack[g], 0, `${g} seated`);
  }
  assert.equal(end.bridgesAway, 0);
  assert.equal(end.isolate, 0);
  assert.equal(end.timeScale, 1);
});

test('the intro frames the watch centred, then glides into the landing composition', () => {
  const intro = sampleFrame(0, createFrame());
  const landing = sampleFrame(INTRO, createFrame());
  assert.equal(intro.shot.frameX, 0);
  assert.ok(landing.shot.frameX > 0.1);
  assert.equal(intro.open.dial, 0);
  assert.equal(intro.explode, 0);
});

test('sampling is a pure function of progress, so scrolling backward reverses the story', () => {
  const forward: string[] = [];
  const frame = createFrame();
  const count = Math.floor(P_END / 0.013);
  for (let i = 0; i <= count; i++) forward.push(JSON.stringify(sampleFrame(i * 0.013, frame)));
  const backward: string[] = [];
  const steps = forward.length;
  for (let i = steps - 1; i >= 0; i--) backward.unshift(JSON.stringify(sampleFrame(i * 0.013, frame)));
  assert.deepEqual(backward, forward);
});

test('no channel jumps between neighbouring scroll positions', () => {
  const a = createFrame();
  const b = createFrame();
  const dp = 0.0005;
  for (let p = 0; p < P_END; p += dp) {
    sampleFrame(p, a);
    sampleFrame(p + dp, b);
    const move = Math.hypot(...a.shot.camera.map((v, i) => v - b.shot.camera[i]));
    assert.ok(move < 0.08, `camera jump ${move.toFixed(3)} at p=${p.toFixed(4)}`);
    assert.ok(Math.abs(a.explode - b.explode) < 0.02, `explode jump at ${p}`);
    assert.ok(Math.abs(Math.log(a.timeScale) - Math.log(b.timeScale)) < 0.2, `time-scale jump at ${p}`);
  }
});

test('the mainspring is let down before it is shown, then wound by the crown', () => {
  const f = createFrame();
  sampleFrame(INTRO + 3.2, f);
  assert.ok(f.barrelOpen < 0.3 || f.wind < 0.1, 'spring relaxes while the barrel is still closed');
  sampleFrame(INTRO + 3.4, f);
  assert.ok(f.barrelOpen > 0.99 && f.wind < 0.1);
  assert.equal(f.handsOn, 'wind');
  sampleFrame(INTRO + 4.0, f);
  assert.ok(f.wind > 0.99 && Math.abs(f.winding - 0.94) < 1e-9);
});

test('the escapement close-up runs in slow motion; the train chapter is a time-lapse', () => {
  const f = createFrame();
  assert.ok(sampleFrame(INTRO + 6.2, f).timeScale < 0.1);
  assert.ok(sampleFrame(INTRO + 4.35, f).timeScale > 500);
  assert.ok(sampleFrame(INTRO + 5.25, f).timeScale === 1);
});

test('chapters and copy are ordered and non-overlapping', () => {
  for (let i = 1; i < CHAPTERS.length; i++) assert.ok(CHAPTERS[i].start > CHAPTERS[i - 1].start);
  for (let i = 1; i < COPY.length; i++) assert.ok(COPY[i].from >= COPY[i - 1].to, `copy ${i} overlaps`);
  assert.equal(chapterIndexAt(0), 0);
  assert.equal(chapterIndexAt(P_END), CHAPTERS.length - 1);
  assert.equal(copyAt(INTRO)?.title.startsWith('Seventeen'), true);
  assert.equal(copyAt(0), null, 'the intro shows the watch alone');
});

test('every tour stop lands on on-screen copy (except the reassembly fly-through)', async () => {
  const { tourStops } = await import('../src/hooks/useTour');
  for (const at of tourStops()) {
    if (at > INTRO + 8.5 && at < P_END - 0.1) continue;
    assert.ok(copyAt(at), `no copy at tour stop p=${at.toFixed(2)}`);
  }
});
