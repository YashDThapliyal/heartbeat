import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAT,
  IDLE_TICK_AFTER,
  demoLength,
  nextBeatWord,
  phaseTimes,
  TICK_SECONDS,
  addWind,
  applyWind,
  createInteraction,
  nextRest,
  requestTick,
  stepTime,
  updateInteraction,
} from '../src/animation/interaction';
import { createFrame, sampleFrame } from '../src/animation/timeline';
import { INTRO } from '../src/animation/chapters';
import { escapementAt } from '../src/movement/simulation';
import { ESCAPEMENT } from '../src/movement/config';

test('a locked rest is a balance extremity with the wheel locked', () => {
  const rest = nextRest(1234.567);
  const s = escapementAt(rest);
  assert.equal(s.phase, 'LOCK');
  assert.ok(Math.abs(Math.abs(s.balance) - ESCAPEMENT.amplitude) < 1e-9);
});

/** Runs the machine for `seconds` of real time at 60 fps. */
function run(it: ReturnType<typeof createInteraction>, time: number, seconds: number): number {
  for (let i = 0; i < Math.round(seconds * 60); i++) time = stepTime(it, time, 1 / 60).time;
  return time;
}

test('arriving at the escapement: it rests, then walks through one beat in slow motion', () => {
  const it = createInteraction();
  const frame = sampleFrame(INTRO + 6.2, createFrame());
  let time = 1000.03;
  updateInteraction(it, frame, 6.2, time, false);
  const rest = nextRest(time);
  time = run(it, time, TICK_SECONDS + 0.1);
  assert.equal(it.tick.demo.state, 'playing');
  assert.ok(Math.abs(it.tick.demo.from - rest) < 1e-9);
  // It visits every phase, in order.
  const seen: string[] = [];
  for (let i = 0; i < demoLength(rest) * 60 + 5; i++) {
    time = stepTime(it, time, 1 / 60).time;
    const phase = escapementAt(time).phase;
    if (seen[seen.length - 1] !== phase) seen.push(phase);
  }
  assert.deepEqual(seen, ['LOCK', 'UNLOCK', 'IMPULSE', 'DROP', 'LOCK']);
  assert.equal(it.tick.demo.state, 'done');
  assert.ok(Math.abs(time - (rest + BEAT)) < 1e-9, 'exactly one beat');
  assert.equal(it.tick.count, 0, 'the demo is not a viewer tap');
});

test('the walkthrough is slow: the impulse alone takes seconds', () => {
  const rest = nextRest(500);
  const [unlock, impulse, drop] = phaseTimes(rest);
  assert.ok(rest < unlock && unlock < impulse && impulse < drop && drop < rest + BEAT);
  assert.ok(demoLength(rest) > 8, `demo lasts ${demoLength(rest).toFixed(1)} s`);
  assert.equal(escapementAt((impulse + drop) / 2).phase, 'IMPULSE');
});

test('after the demo, each tap lets exactly one beat through, alternating tick and tock', () => {
  const it = createInteraction();
  const frame = sampleFrame(INTRO + 6.2, createFrame());
  let time = 2000.01;
  updateInteraction(it, frame, 6.2, time, false);
  time = run(it, time, TICK_SECONDS + 0.1);
  time = run(it, time, demoLength(it.tick.demo.from) + 0.2);
  const words = [nextBeatWord(it)];
  const before = escapementAt(time).escapeAngle;
  requestTick(it, time);
  time = run(it, time, TICK_SECONDS + 0.2);
  words.push(nextBeatWord(it));
  assert.ok(Math.abs(escapementAt(time).escapeAngle - before - Math.PI / ESCAPEMENT.teeth) < 1e-9, 'half a tooth');
  assert.equal(escapementAt(time).phase, 'LOCK');
  assert.notEqual(words[0], words[1], 'tick, then tock');
  assert.equal(it.tick.count, 1);
});

test('tapping during the walkthrough skips ahead instead of queuing', () => {
  const it = createInteraction();
  const frame = sampleFrame(INTRO + 6.2, createFrame());
  let time = 300;
  updateInteraction(it, frame, 6.2, time, false);
  time = run(it, time, 2);
  assert.equal(it.tick.demo.state, 'playing');
  const from = it.tick.demo.from;
  requestTick(it, time);
  time = run(it, time, TICK_SECONDS + 0.2);
  assert.ok(Math.abs(time - (from + BEAT)) < 1e-9);
});

test('left alone after the demo, the escapement keeps ticking by itself', () => {
  const it = createInteraction();
  const frame = sampleFrame(INTRO + 6.2, createFrame());
  let time = 50;
  updateInteraction(it, frame, 6.2, time, false);
  time = run(it, time, TICK_SECONDS + 0.1);
  const from = it.tick.demo.from;
  time = run(it, time, demoLength(from) + IDLE_TICK_AFTER + TICK_SECONDS + 0.5);
  assert.ok(Math.abs(time - (from + 2 * BEAT)) < 1e-9);
});

test('winding by hand fills the mainspring; leaving the chapter lets it down', () => {
  const it = createInteraction();
  const frame = sampleFrame(INTRO + 3.5, createFrame());
  assert.ok(frame.wind < 0.1);
  addWind(it, 0.5);
  applyWind(frame, it);
  assert.ok(Math.abs(frame.wind - 0.56) < 1e-9);
  assert.ok(Math.abs(frame.winding - 0.5) < 1e-9);
  addWind(it, 5);
  assert.equal(it.wind, 1);
  updateInteraction(it, frame, 2.0, 0, false);
  assert.equal(it.wind, 0);
});
