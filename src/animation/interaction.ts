/**
 * The two hands-on moments.
 *
 * Wind it: the viewer's winding adds to the mainspring (the story's own wind
 * only takes over if they scroll on without winding).
 *
 * Tick it: in the escapement close-up the machine comes to rest, locked, then
 * plays one beat in very slow motion, pausing on each phase (locked, unlock,
 * impulse, drop). After that it is the viewer's turn: each tap lets exactly one
 * beat through, alternating tick and tock, and the machine rests again.
 */
import { BEATS_PER_SECOND } from '../movement/config';
import { escapementAt, type EscapementPhase } from '../movement/simulation';
import type { StoryFrame } from './timeline';

/** Simulation seconds from one locked rest to the next. */
export const BEAT = 1 / BEATS_PER_SECOND;
/** A tapped beat plays over this many real seconds. */
export const TICK_SECONDS = 1.1;
/** Wind added per pixel of drag, and per second of holding the wind button. */
export const WIND_PER_PIXEL = 1 / 900;
export const WIND_PER_SECOND = 0.42;
/** After the demo, with no taps for this long, the escapement ticks by itself. */
export const IDLE_TICK_AFTER = 6;
const LET_DOWN = 0.06;
/** Wind level treated as fully wound. */
export const WOUND = 0.97;
const MAX_QUEUED_BEATS = 3;

export interface Interaction {
  /** Mainspring wind supplied by the viewer (0 = let down, 1 = fully wound). */
  wind: number;
  /** True while the wind button is held. */
  windHeld: boolean;
  tick: {
    /** Stepping mode is on: the clock only runs toward `holdAt`. */
    manual: boolean;
    /** Simulation time at which the clock will stop (a locked rest). */
    holdAt: number;
    /** Beats the viewer has triggered this visit. */
    count: number;
    /** Seconds since the last tap (or since stepping began). */
    idle: number;
    /** The slow-motion walkthrough of one beat. */
    demo: { state: 'pending' | 'playing' | 'done'; from: number; t: number };
  };
}

/**
 * The walkthrough: each phase of one beat is played at its own pace (real
 * seconds), with a short pause where the next phase begins.
 */
const DEMO_PACE: readonly { until: EscapementPhase | 'REST'; seconds: number }[] = [
  { until: 'UNLOCK', seconds: 1.6 },
  { until: 'IMPULSE', seconds: 1.8 },
  { until: 'DROP', seconds: 2.4 },
  { until: 'LOCK', seconds: 1.4 },
  { until: 'REST', seconds: 1.2 },
];
const DEMO_PAUSE = 0.7;

/** Simulation times at which each phase of the beat starting at `rest` begins. */
export function phaseTimes(rest: number): number[] {
  const order: EscapementPhase[] = ['UNLOCK', 'IMPULSE', 'DROP', 'LOCK'];
  const times: number[] = [];
  let lo = rest;
  for (const phase of order) {
    // Scan for the first sample in the phase, then refine by bisection.
    const steps = 400;
    let hi = rest + BEAT;
    for (let i = 1; i <= steps; i++) {
      const t = lo + ((rest + BEAT - lo) * i) / steps;
      if (escapementAt(t).phase === phase) {
        hi = t;
        break;
      }
    }
    let a = lo;
    for (let k = 0; k < 40; k++) {
      const mid = (a + hi) / 2;
      if (escapementAt(mid).phase === phase) hi = mid;
      else a = mid;
    }
    times.push(hi);
    lo = hi;
  }
  return times;
}

interface DemoSchedule {
  /** [sim start, sim end, real start, real end] per segment. */
  segments: [number, number, number, number][];
  total: number;
}

function demoSchedule(rest: number): DemoSchedule {
  const marks = [rest, ...phaseTimes(rest), rest + BEAT];
  const segments: [number, number, number, number][] = [];
  let real = 0;
  DEMO_PACE.forEach((pace, i) => {
    segments.push([marks[i], marks[i + 1], real, real + pace.seconds]);
    real += pace.seconds + (i < DEMO_PACE.length - 1 ? DEMO_PAUSE : 0);
  });
  return { segments, total: real };
}

let cachedSchedule: { rest: number; schedule: DemoSchedule } | null = null;
function scheduleFor(rest: number): DemoSchedule {
  if (!cachedSchedule || cachedSchedule.rest !== rest) cachedSchedule = { rest, schedule: demoSchedule(rest) };
  return cachedSchedule.schedule;
}

/** Simulation time `realT` seconds into the walkthrough (pauses hold still). */
export function demoTime(rest: number, realT: number): number {
  const { segments } = scheduleFor(rest);
  for (const [s0, s1, r0, r1] of segments) {
    if (realT < r0) return s0;
    if (realT <= r1) return s0 + ((s1 - s0) * (realT - r0)) / (r1 - r0);
  }
  return rest + BEAT;
}

export function demoLength(rest: number): number {
  return scheduleFor(rest).total;
}

export function createInteraction(): Interaction {
  return {
    wind: 0,
    windHeld: false,
    tick: { manual: false, holdAt: 0, count: 0, idle: 0, demo: { state: 'pending', from: 0, t: 0 } },
  };
}

/** The next locked rest at or after time t. */
export function nextRest(t: number): number {
  return Math.ceil(t / BEAT - 1e-9) * BEAT;
}

/** Winding that the viewer can see and feel: effective wind and crown progress. */
export function applyWind(frame: StoryFrame, it: Interaction): void {
  const w = Math.max(frame.wind, it.wind);
  frame.wind = w;
  frame.winding = Math.max(frame.winding, w - LET_DOWN);
}

export function addWind(it: Interaction, amount: number): void {
  it.wind = Math.min(1, Math.max(LET_DOWN, it.wind) + amount);
}

/** Request one more beat. Returns false if too many are already queued. */
export function requestTick(it: Interaction, time: number): boolean {
  const t = it.tick;
  if (!t.manual) {
    t.manual = true;
    t.holdAt = nextRest(time);
  }
  if (t.demo.state === 'playing') {
    // A tap during the walkthrough finishes that beat at tapping speed.
    t.demo.state = 'done';
    t.holdAt = t.demo.from + BEAT;
    t.count += 1;
    t.idle = 0;
    return true;
  }
  t.demo.state = 'done';
  if (t.holdAt - time > BEAT * MAX_QUEUED_BEATS) return false;
  t.holdAt += BEAT;
  t.count += 1;
  t.idle = 0;
  return true;
}

/**
 * Advances time under stepping mode and returns the rate used. While a beat is
 * pending the clock runs at BEAT / TICK_SECONDS; at a rest it stops. The first
 * rest of a visit starts the slow-motion walkthrough.
 */
export function stepTime(it: Interaction, time: number, dt: number): { time: number; rate: number } {
  const t = it.tick;
  const demo = t.demo;
  if (demo.state === 'pending' && time >= t.holdAt) {
    demo.state = 'playing';
    demo.from = t.holdAt;
    demo.t = 0;
  }
  if (demo.state === 'playing') {
    const before = demoTime(demo.from, demo.t);
    demo.t += dt;
    const now = demoTime(demo.from, demo.t);
    if (demo.t >= demoLength(demo.from)) {
      demo.state = 'done';
      t.holdAt = demo.from + BEAT;
      t.idle = 0;
    }
    return { time: now, rate: dt > 0 ? (now - before) / dt : 0 };
  }
  t.idle += dt;
  if (demo.state === 'done' && t.idle > IDLE_TICK_AFTER && t.holdAt - time < 1e-9) {
    t.holdAt += BEAT;
    t.idle = 0;
  }
  const rate = BEAT / TICK_SECONDS;
  if (time >= t.holdAt) return { time: t.holdAt, rate: 0 };
  const next = Math.min(t.holdAt, time + dt * rate);
  return { time: next, rate };
}

/** The beat the next tap will play: 'TICK' or 'TOCK'. */
export function nextBeatWord(it: Interaction): 'TICK' | 'TOCK' {
  return escapementAt(it.tick.holdAt + BEAT / 2).tick;
}

/** Called every frame: enter/leave stepping mode and reset between visits. */
export function updateInteraction(it: Interaction, frame: StoryFrame, storyP: number, time: number, explore: boolean): void {
  const t = it.tick;
  const inTick = !explore && frame.handsOn === 'tick';
  if (inTick && !t.manual) {
    // Come to rest at the next locked moment, then wait for the viewer.
    t.manual = true;
    t.holdAt = nextRest(time);
    t.idle = 0;
  } else if (!inTick && t.manual) {
    t.manual = false;
  }
  if (!inTick) {
    t.count = 0;
    t.demo.state = 'pending';
  }
  // Scrolling back before the Store chapter lets the spring down again.
  if (storyP < 3.3) it.wind = 0;
}
