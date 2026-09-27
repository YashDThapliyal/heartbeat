/**
 * Mechanical state as a pure function of simulation time.
 *
 * One phase variable drives everything: the balance angle θ = A·cos(ωt).
 * The fork, escape wheel, train and hands are all derived from it, so the
 * machine can never drift out of sync with itself.
 */
import {
  ARBORS,
  BEATS_PER_SECOND,
  BALANCE_HZ,
  ESCAPEMENT,
  WINDING,
  type ArborId,
} from './config';

export const TAU = Math.PI * 2;

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (x: number): number => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export type EscapementPhase = 'LOCK' | 'UNLOCK' | 'IMPULSE' | 'DROP';
export type Stone = 'entry' | 'exit';

export interface EscapementState {
  /** Balance angle (radians, 0 = rest). */
  balance: number;
  /** Fork angle about the pallet pivot (radians). */
  fork: number;
  /** Absolute escape wheel angle (radians, counter-clockwise). */
  escapeAngle: number;
  /** Index of the nearest dead-point crossing (one per beat). */
  beat: number;
  /** Fork travel through the current crossing: 0 = before, 1 = after. */
  progress: number;
  phase: EscapementPhase;
  /** Stone currently holding the wheel (LOCK) or releasing it (other phases). */
  stone: Stone;
  tick: 'TICK' | 'TOCK';
  /** 1 while the impulse pin is inside the fork, fading out around it. */
  engagement: number;
}

const HALF_PITCH = TAU / ESCAPEMENT.teeth / 2;
const OMEGA = TAU * BALANCE_HZ;
const ENTRY_ANGLE = ESCAPEMENT.lineOfCentres - ESCAPEMENT.stoneHalfSpan;
/** Escape angle at t = 0: a tooth tip resting against the entry stone. */
export const ESCAPE_REFERENCE = ENTRY_ANGLE - ESCAPEMENT.lockOffset;

const even = (k: number): boolean => ((k % 2) + 2) % 2 === 0;

/** Wheel advance through one beat (0..1 of a half-pitch) from fork progress. */
export function advanceFromProgress(s: number): number {
  const { unlockAt, impulseEndsAt, dropEndsAt, impulseShare } = ESCAPEMENT;
  if (s <= unlockAt) return 0;
  if (s < impulseEndsAt) return impulseShare * smoothstep((s - unlockAt) / (impulseEndsAt - unlockAt));
  if (s < dropEndsAt) {
    const d = (s - impulseEndsAt) / (dropEndsAt - impulseEndsAt);
    return impulseShare + (1 - impulseShare) * d * d;
  }
  return 1;
}

function phaseFromProgress(s: number): EscapementPhase {
  if (s <= 0 || s >= ESCAPEMENT.dropEndsAt) return 'LOCK';
  if (s <= ESCAPEMENT.unlockAt) return 'UNLOCK';
  if (s < ESCAPEMENT.impulseEndsAt) return 'IMPULSE';
  return 'DROP';
}

export function escapementAt(time: number): EscapementState {
  const { amplitude, liftHalfAngle, forkBanking } = ESCAPEMENT;
  const balance = amplitude * Math.cos(OMEGA * time);
  // Dead-point crossings happen at ωt = π/2 + kπ.
  const beat = Math.round(BEATS_PER_SECOND * time - 0.5);
  const q = Math.max(-1, Math.min(1, balance / liftHalfAngle));
  const approachSign = even(beat) ? 1 : -1;
  const progress = (1 - q * approachSign) / 2;
  // The impulse pin and fork notch meet like two meshing wheels, so they turn oppositely.
  const fork = -forkBanking * q;
  const escapeAngle = ESCAPE_REFERENCE + (beat + advanceFromProgress(progress)) * HALF_PITCH;
  const phase = phaseFromProgress(progress);
  const releasing: Stone = even(beat) ? 'entry' : 'exit';
  const other: Stone = releasing === 'entry' ? 'exit' : 'entry';
  const stone = phase === 'LOCK' && progress >= ESCAPEMENT.dropEndsAt ? other : releasing;
  const engagement = 1 - smoothstep((Math.abs(balance) - liftHalfAngle) / (liftHalfAngle * 1.4));
  return { balance, fork, escapeAngle, beat, progress, phase, stone, tick: even(beat) ? 'TICK' : 'TOCK', engagement };
}

/** Average (non-stepping) escape angle, used when beats are faster than the eye. */
export function escapeAngleAveraged(time: number): number {
  return ESCAPE_REFERENCE + BEATS_PER_SECOND * time * HALF_PITCH;
}

const ESCAPE_OMEGA = BEATS_PER_SECOND * HALF_PITCH;

/** Angular velocity of each arbor relative to the escape wheel. */
const RATIOS: Record<ArborId, number> = (() => {
  const ratios = { escape: 1 } as Record<ArborId, number>;
  for (let i = ARBORS.length - 1; i > 0; i--) {
    const driven = ARBORS[i];
    const driver = ARBORS[i - 1];
    ratios[driver.id] = ratios[driven.id] * (-driven.pinion!.leaves / driver.wheel.teeth);
  }
  return ratios;
})();

export function ratioToEscape(id: ArborId): number {
  return RATIOS[id];
}

/** Mean angular velocity (rad/s) at real-time speed. */
export function angularVelocity(id: ArborId): number {
  return ESCAPE_OMEGA * RATIOS[id];
}

export function revolutionSeconds(id: ArborId): number {
  return TAU / Math.abs(angularVelocity(id));
}

export type ArborAngles = Record<ArborId, number>;

/**
 * Constant angular offsets that seat a tooth opposite a gap on every line of
 * centres. Because the ratios are exact, the alignment then holds forever.
 */
export function meshPhaseOffsets(): ArborAngles {
  const offsets = { escape: ESCAPE_REFERENCE } as ArborAngles;
  for (let i = ARBORS.length - 1; i > 0; i--) {
    const driven = ARBORS[i];
    const driver = ARBORS[i - 1];
    const d = Math.atan2(driven.position[1] - driver.position[1], driven.position[0] - driver.position[0]);
    const nDriven = (driven.pinion!.leaves * (d + Math.PI - offsets[driven.id])) / TAU;
    offsets[driver.id] = d - (TAU * (0.5 - nDriven)) / driver.wheel.teeth;
  }
  return offsets;
}

export function trainAngles(escapeAngle: number, offsets: ArborAngles): ArborAngles {
  const delta = escapeAngle - ESCAPE_REFERENCE;
  const angles = {} as ArborAngles;
  for (const arbor of ARBORS) angles[arbor.id] = offsets[arbor.id] + RATIOS[arbor.id] * delta;
  return angles;
}

export interface HandAngles {
  hour: number;
  minute: number;
  second: number;
}

/**
 * Hands ride on the train: minutes on the centre arbor, small seconds on the
 * fourth arbor, hours through 12:1 motion works. Angle 0 points at twelve.
 */
export function handAngles(angles: ArborAngles, offsets: ArborAngles): HandAngles {
  const minute = angles.center - offsets.center;
  return { minute, hour: minute / 12, second: angles.fourth - offsets.fourth };
}

export interface WindingAngles {
  crown: number;
  crownWheel: number;
  ratchet: number;
  click: number;
}

/** Winding chain angles for a wind level (0 = let down, 1 = fully wound). */
export function windingAngles(wind: number): WindingAngles {
  const crown = wind * WINDING.crownTurnsForFullWind * TAU;
  const crownWheel = -crown * (WINDING.windingPinionTeeth / WINDING.crownWheelTeeth);
  const ratchet = -crownWheel * (WINDING.crownWheelTeeth / WINDING.ratchetTeeth);
  // The click rides up each ratchet tooth and snaps back: a sawtooth.
  const toothPhase = ((ratchet / (TAU / WINDING.ratchetTeeth)) % 1 + 1) % 1;
  return { crown, crownWheel, ratchet, click: toothPhase };
}
