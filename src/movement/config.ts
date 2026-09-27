/**
 * Heartbeat 01 — an original, educational hand-wound Swiss-lever movement.
 *
 * All dimensions are in scene units (the movement is ~4.3 units across).
 * The plan view is the XY plane; +Z points from the mainplate toward the dial.
 * Positions of train arbors are *derived* from tooth counts and modules, so every
 * wheel sits exactly one pitch distance from the pinion it drives.
 */

export type Vec2 = readonly [number, number];
export type Vec3 = [number, number, number];

export type ArborId = 'barrel' | 'center' | 'third' | 'fourth' | 'escape';

export interface WheelSpec {
  teeth: number;
  module: number;
  pitchRadius: number;
  /** Mid-plane height above the mainplate. */
  z: number;
  thickness: number;
  spokes: number;
}

export interface PinionSpec {
  leaves: number;
  module: number;
  pitchRadius: number;
  z: number;
  length: number;
}

export interface Arbor {
  id: ArborId;
  label: string;
  position: Vec2;
  wheel: WheelSpec;
  /** Driven pinion (absent on the barrel, which is driven by the mainspring). */
  pinion?: PinionSpec;
}

/** Balance frequency: 2.5 Hz = 5 beats per second = 18,000 beats per hour. */
export const BALANCE_HZ = 2.5;
export const BEATS_PER_SECOND = BALANCE_HZ * 2;

export const PLATE_RADIUS = 2.12;
export const MOVEMENT_TOP = 0.74;

const DEG = Math.PI / 180;
const polar = (origin: Vec2, distance: number, degrees: number): Vec2 => [
  origin[0] + Math.cos(degrees * DEG) * distance,
  origin[1] + Math.sin(degrees * DEG) * distance,
];

function wheel(teeth: number, module: number, z: number, spokes: number, thickness = 0.045): WheelSpec {
  return { teeth, module, pitchRadius: (teeth * module) / 2, z, thickness, spokes };
}

function pinion(leaves: number, module: number, z: number, length: number): PinionSpec {
  return { leaves, module, pitchRadius: (leaves * module) / 2, z, length };
}

/** Intersection of two circles, choosing the solution with the larger x. */
function circleIntersection(a: Vec2, ra: number, b: Vec2, rb: number): Vec2 {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const along = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - along * along));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const px = a[0] + ux * along;
  const py = a[1] + uy * along;
  const p1: Vec2 = [px - uy * h, py + ux * h];
  const p2: Vec2 = [px + uy * h, py - ux * h];
  return p1[0] > p2[0] ? p1 : p2;
}

// Wheels (driver) and pinions (driven) share a module per stage.
const M_BARREL = 0.0234;
const M_CENTER = 0.0244;
const M_THIRD = 0.0165;
const M_FOURTH = 0.014;

const barrelWheel = wheel(80, M_BARREL, 0.11, 0, 0.06);
const centerWheel = wheel(64, M_CENTER, 0.05, 5);
const centerPinion = pinion(10, M_BARREL, 0.11, 0.1);
const thirdWheel = wheel(75, M_THIRD, 0.245, 5);
const thirdPinion = pinion(8, M_CENTER, 0.05, 0.08);
const fourthWheel = wheel(80, M_FOURTH, 0.135, 4, 0.04);
const fourthPinion = pinion(10, M_THIRD, 0.245, 0.08);
const escapePinion = pinion(8, M_FOURTH, 0.135, 0.07);

const CENTER: Vec2 = [0, 0];
/** Fourth wheel sits at six o'clock so it can carry the small seconds hand. */
const FOURTH: Vec2 = [0, -1.12];
const THIRD = circleIntersection(
  CENTER,
  centerWheel.pitchRadius + thirdPinion.pitchRadius,
  FOURTH,
  thirdWheel.pitchRadius + fourthPinion.pitchRadius,
);
const BARREL = polar(CENTER, barrelWheel.pitchRadius + centerPinion.pitchRadius, 70);
const ESCAPE = polar(FOURTH, fourthWheel.pitchRadius + escapePinion.pitchRadius, 160);

export const ESCAPE_TEETH = 15;

export const ARBORS: readonly Arbor[] = [
  { id: 'barrel', label: 'Mainspring barrel', position: BARREL, wheel: barrelWheel },
  { id: 'center', label: 'Center wheel', position: CENTER, wheel: centerWheel, pinion: centerPinion },
  { id: 'third', label: 'Third wheel', position: THIRD, wheel: thirdWheel, pinion: thirdPinion },
  { id: 'fourth', label: 'Fourth wheel', position: FOURTH, wheel: fourthWheel, pinion: fourthPinion },
  {
    id: 'escape',
    label: 'Escape wheel',
    position: ESCAPE,
    // The escape wheel is not module-cut; pitchRadius is its tooth-tip radius.
    wheel: { teeth: ESCAPE_TEETH, module: 0, pitchRadius: 0.36, z: 0.245, thickness: 0.04, spokes: 4 },
    pinion: escapePinion,
  },
];

export function arborById(id: ArborId): Arbor {
  const arbor = ARBORS.find(a => a.id === id);
  if (!arbor) throw new Error(`Unknown arbor: ${id}`);
  return arbor;
}

/**
 * Swiss lever escapement geometry.
 * Pallet stones span 2½ teeth (±30° about the line of centres). The pallet pivot
 * sits where the tangents from those stones meet, so the fork's rotation moves
 * each stone radially in and out of the tooth circle.
 */
const TIP_RADIUS = 0.36;
const LINE_OF_CENTRES = 120 * DEG;
const STONE_HALF_SPAN = 30 * DEG;
const PALLET_DISTANCE = TIP_RADIUS / Math.cos(STONE_HALF_SPAN);
const FORK_BANKING = 11 * DEG;
const LIFT_HALF_ANGLE = 28 * DEG;
const FORK_LENGTH = 0.58;
/** Chosen so the impulse pin and fork notch travel together inside the lift. */
const ROLLER_RADIUS = (FORK_BANKING / LIFT_HALF_ANGLE) * FORK_LENGTH;
const STONE_ARM = TIP_RADIUS * Math.tan(STONE_HALF_SPAN);
const LOCK_DEPTH = 0.028;
const STONE_TRAVEL = STONE_ARM * 2 * FORK_BANKING;

export const ESCAPEMENT = {
  teeth: ESCAPE_TEETH,
  tipRadius: TIP_RADIUS,
  rootRadius: 0.265,
  center: ESCAPE,
  lineOfCentres: LINE_OF_CENTRES,
  palletPivot: polar(ESCAPE, PALLET_DISTANCE, 120),
  palletDistance: PALLET_DISTANCE,
  stoneHalfSpan: STONE_HALF_SPAN,
  stoneArm: STONE_ARM,
  stoneWidth: 0.05,
  lockDepth: LOCK_DEPTH,
  stoneTravel: STONE_TRAVEL,
  forkBanking: FORK_BANKING,
  forkLength: FORK_LENGTH,
  liftHalfAngle: LIFT_HALF_ANGLE,
  rollerRadius: ROLLER_RADIUS,
  balanceCenter: polar(ESCAPE, PALLET_DISTANCE + FORK_LENGTH + ROLLER_RADIUS, 120),
  /** Visual amplitude of the balance, either side of rest. */
  amplitude: 200 * DEG,
  /** Fork progress at which the locking stone clears the tooth tip. */
  unlockAt: LOCK_DEPTH / STONE_TRAVEL,
  impulseEndsAt: 0.86,
  dropEndsAt: 0.94,
  /** Fraction of the half-pitch covered by impulse (the remainder is drop). */
  impulseShare: 0.84,
  /** How far behind the stone centre a locked tooth tip rests (radians). */
  lockOffset: 4.8 * DEG,
  z: 0.245,
} as const;

export const BALANCE = {
  center: ESCAPEMENT.balanceCenter,
  rimRadius: 0.64,
  rimWidth: 0.075,
  rimZ: 0.47,
  hairspringZ: 0.575,
  hairspringInner: 0.075,
  hairspringOuter: 0.44,
  hairspringTurns: 11,
  rollerZ: 0.26,
} as const;

/** Winding chain: crown → stem → winding pinion → crown wheel → ratchet → barrel arbor. */
const RATCHET_TEETH = 42;
const CROWN_WHEEL_TEETH = 20;
const M_WINDING = 0.03;
const RATCHET_RADIUS = (RATCHET_TEETH * M_WINDING) / 2;
const CROWN_WHEEL_RADIUS = (CROWN_WHEEL_TEETH * M_WINDING) / 2;

const CROWN_WHEEL = polar(BARREL, RATCHET_RADIUS + CROWN_WHEEL_RADIUS, -50);
const WINDING_PINION_TEETH = 12;
/** Barrel-arbor turns from let-down to fully wound; each barrel turn lasts 8 h. */
const BARREL_TURNS_FULL = 6;

export const WINDING = {
  ratchetTeeth: RATCHET_TEETH,
  ratchetRadius: RATCHET_RADIUS,
  crownWheelTeeth: CROWN_WHEEL_TEETH,
  crownWheelRadius: CROWN_WHEEL_RADIUS,
  crownWheel: CROWN_WHEEL,
  windingPinionTeeth: WINDING_PINION_TEETH,
  windingPinionRadius: 0.065,
  /** The stem runs just beneath the crown wheel's rim. */
  stemY: CROWN_WHEEL[1] - CROWN_WHEEL_RADIUS,
  stemZ: 0.46,
  stemInnerX: CROWN_WHEEL[0] - 0.08,
  /** Mid-plane of ratchet and crown wheel, on top of the barrel bridge. */
  topZ: 0.55,
  crownX: 2.86,
  barrelTurnsFull: BARREL_TURNS_FULL,
  crownTurnsForFullWind: (BARREL_TURNS_FULL * RATCHET_TEETH) / WINDING_PINION_TEETH,
} as const;

export const BARREL_SPEC = {
  drumRadius: arborById('barrel').wheel.pitchRadius - 0.05,
  innerRadius: arborById('barrel').wheel.pitchRadius - 0.1,
  arborRadius: 0.13,
  bottomZ: 0.08,
  topZ: 0.4,
} as const;

export const LEVELS = {
  plateTop: 0,
  plateBottom: -0.24,
  trainBridge: [0.33, 0.41] as const,
  barrelBridge: [0.43, 0.51] as const,
  palletCock: [0.3, 0.36] as const,
  balanceCock: [0.64, 0.72] as const,
  dial: 0.84,
  crystal: 1.08,
} as const;

export const WATCH = {
  caseRadius: 2.62,
  dialRadius: 2.28,
  subSeconds: FOURTH,
} as const;
