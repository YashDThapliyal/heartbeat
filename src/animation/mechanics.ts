/**
 * Advances the simulation clock and derives the whole mechanical state for
 * this frame. Story state decides *how fast* time runs; the mechanism itself
 * is always the pure function of time from simulation.ts.
 */
import type { Story } from './story';
import { MESH_OFFSETS } from './story';
import { BEATS_PER_SECOND, ESCAPEMENT } from '../movement/config';
import { WIND_PER_SECOND, addWind, applyWind, stepTime, updateInteraction } from './interaction';
import { INTRO } from './chapters';
import {
  escapeAngleAveraged,
  escapementAt,
  handAngles,
  mix,
  smoothstep,
  TAU,
  trainAngles,
  windingAngles,
  type EscapementState,
} from '../movement/simulation';

/** Displayed balance frequency once real beats are too fast to follow. */
const VISUAL_BLUR_HZ = 3;

/** At the moment of release, bullet time slows the clock a further ×BULLET. */
const BULLET = 0.28;

export function currentRate(story: Story): number {
  if (story.explore) return story.controls.playing ? story.controls.speed : 0;
  const f = story.frame;
  const bullet = mix(1, BULLET, f.bulletTime * story.mech.escapement.engagement);
  return f.timeScale * bullet;
}

/**
 * Far above real speed the true balance phase would alias into flicker, so the
 * oscillator is shown swinging at a steady, capped rate (as the eye would see a blur).
 */
function blurredOscillator(state: EscapementState, blur: number, elapsed: number): EscapementState {
  const shown = ESCAPEMENT.amplitude * 0.55 * Math.cos(TAU * VISUAL_BLUR_HZ * elapsed);
  const balance = mix(state.balance, shown, blur);
  const q = Math.max(-1, Math.min(1, balance / ESCAPEMENT.liftHalfAngle));
  return { ...state, balance, fork: mix(state.fork, -ESCAPEMENT.forkBanking * q, blur) };
}

export function advanceMechanics(story: Story, dt: number): void {
  const it = story.interact;
  updateInteraction(it, story.frame, story.p - INTRO, story.time, story.explore);
  if (it.windHeld && story.frame.handsOn === 'wind') addWind(it, WIND_PER_SECOND * dt);
  if (!story.explore) applyWind(story.frame, it);
  let rate = currentRate(story);
  if (it.tick.manual) {
    const stepped = stepTime(it, story.time, dt);
    story.time = stepped.time;
    rate = stepped.rate;
  } else {
    story.time += dt * rate;
  }
  const escapement = escapementAt(story.time);
  // Beyond ~8 beats per second the eye sees a blur, and stepping would alias.
  const beatBlur = smoothstep((BEATS_PER_SECOND * Math.abs(rate) - 8) / 14);
  const escapeAngle = mix(escapement.escapeAngle, escapeAngleAveraged(story.time), beatBlur);
  const angles = trainAngles(escapeAngle, MESH_OFFSETS);
  const m = story.mech;
  m.escapement = beatBlur > 0 ? blurredOscillator(escapement, beatBlur, story.elapsed) : escapement;
  m.angles = angles;
  m.hands = handAngles(angles, MESH_OFFSETS);
  m.winding = windingAngles(story.explore ? 1 : story.frame.winding);
  m.rate = rate;
  m.beatBlur = beatBlur;
}
