/**
 * Plan-view layout of the structural parts: plate, bridges, cocks, and where
 * each of the seventeen jewels and the screws sit. Every boss is placed on a
 * real pivot from the movement configuration.
 */
import { ARBORS, BALANCE, ESCAPEMENT, LEVELS, PLATE_RADIUS, WINDING, arborById, type Vec2 } from './config';
import { box, capsule, circle, subtract, union, type Bounds, type Sdf } from '../geometry/outline';

const pos = (id: Parameters<typeof arborById>[0]): Vec2 => arborById(id).position;

const C = pos('center');
const T = pos('third');
const F = pos('fourth');
const E = pos('escape');
const BARREL = pos('barrel');
const P = ESCAPEMENT.palletPivot;
const B = BALANCE.center;
const CW = WINDING.crownWheel;

const toward = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export interface BridgeSpec {
  id: 'trainBridge' | 'barrelBridge' | 'palletCock' | 'balanceCock';
  label: string;
  sdf: Sdf;
  bounds: Bounds;
  z: readonly [number, number];
  /** Feet that stand on pillars down to the plate. */
  feet: readonly Vec2[];
  screws: readonly Vec2[];
}

const FOOT_TRAIN_A: Vec2 = [1.5, -1.18];
const FOOT_TRAIN_B: Vec2 = [-0.98, -1.66];
const FOOT_TRAIN_C: Vec2 = [-0.42, 0.34];
const FOOT_BARREL_A: Vec2 = [1.42, 1.34];
const FOOT_BARREL_B: Vec2 = [-0.6, 1.58];
const FOOT_BARREL_C: Vec2 = [1.66, 0.36];
const FOOT_PALLET: Vec2 = [-1.42, -1.1];
const FOOT_BALANCE: Vec2 = [-1.62, 1.1];

const trainBridge: BridgeSpec = {
  id: 'trainBridge',
  label: 'Train bridge',
  sdf: subtract(
    union(
      0.16,
      capsule(C, T, 0.2, 0.15),
      capsule(T, F, 0.15, 0.15),
      capsule(F, E, 0.15, 0.13),
      capsule(C, FOOT_TRAIN_C, 0.17, 0.13),
      capsule(T, FOOT_TRAIN_A, 0.13, 0.15),
      capsule(E, FOOT_TRAIN_B, 0.12, 0.15),
      capsule(C, F, 0.1, 0.1),
    ),
    circle(toward(toward(C, T, 0.5), F, 0.36), 0.13),
  ),
  bounds: { minX: -1.3, minY: -1.95, maxX: 1.8, maxY: 0.65 },
  z: LEVELS.trainBridge,
  feet: [FOOT_TRAIN_A, FOOT_TRAIN_B, FOOT_TRAIN_C],
  screws: [FOOT_TRAIN_A, FOOT_TRAIN_B, FOOT_TRAIN_C],
};

const barrelBridge: BridgeSpec = {
  id: 'barrelBridge',
  label: 'Barrel bridge',
  sdf: subtract(
    union(
      0.2,
      circle(BARREL, 0.5),
      capsule(BARREL, CW, 0.34, 0.27),
      capsule(BARREL, FOOT_BARREL_A, 0.3, 0.16),
      capsule(BARREL, FOOT_BARREL_B, 0.3, 0.16),
      capsule(CW, FOOT_BARREL_C, 0.2, 0.15),
    ),
    // Keep the winding stem clear.
    box([1.6, WINDING.stemY], 1.2, 0.08),
  ),
  bounds: { minX: -1.0, minY: -0.3, maxX: 2.0, maxY: 2.0 },
  z: LEVELS.barrelBridge,
  feet: [FOOT_BARREL_A, FOOT_BARREL_B, FOOT_BARREL_C],
  screws: [FOOT_BARREL_A, FOOT_BARREL_B, FOOT_BARREL_C],
};

const palletCock: BridgeSpec = {
  id: 'palletCock',
  label: 'Pallet bridge',
  sdf: union(0.12, circle(P, 0.11), capsule(P, FOOT_PALLET, 0.08, 0.14)),
  bounds: { minX: -1.75, minY: -1.4, maxX: -0.5, maxY: -0.3 },
  z: LEVELS.palletCock,
  feet: [FOOT_PALLET],
  screws: [FOOT_PALLET],
};

const balanceCock: BridgeSpec = {
  id: 'balanceCock',
  label: 'Balance cock',
  sdf: union(0.22, circle(B, 0.15), capsule(B, FOOT_BALANCE, 0.1, 0.24), circle(FOOT_BALANCE, 0.3)),
  bounds: { minX: -2.1, minY: -0.2, maxX: -0.9, maxY: 1.6 },
  z: LEVELS.balanceCock,
  feet: [FOOT_BALANCE],
  screws: [toward(FOOT_BALANCE, B, 0.12)],
};

export const BRIDGES: readonly BridgeSpec[] = [trainBridge, barrelBridge, palletCock, balanceCock];

/** Mainplate with recessed pockets for the barrel and balance. */
export const PLATE = {
  outline: circle([0, 0], PLATE_RADIUS),
  pockets: [
    { center: BARREL, radius: 0.97, depth: 0.06 },
    { center: B, radius: 0.76, depth: 0.08 },
  ],
  bounds: { minX: -2.2, minY: -2.2, maxX: 2.2, maxY: 2.2 },
} as const;

export interface JewelSpec {
  at: Vec2;
  z: number;
  /** Which part carries it (so it moves and dims with that part). */
  carrier: 'mainplate' | BridgeSpec['id'];
}

const trainTop = LEVELS.trainBridge[1];
const plateTop = LEVELS.plateTop;

/**
 * Seventeen jewels: 2 each for the centre, third, fourth and escape arbors,
 * 2 for the pallet arbor, 2 pallet stones, 2 hole jewels and 2 cap jewels for
 * the balance staff, and the impulse jewel. The stones and impulse jewel live
 * on the pallet fork and roller; the rest are listed here.
 */
export const JEWELS: readonly JewelSpec[] = [
  ...ARBORS.filter(a => a.id !== 'barrel').flatMap<JewelSpec>(a => [
    { at: a.position, z: plateTop, carrier: 'mainplate' },
    { at: a.position, z: trainTop, carrier: 'trainBridge' },
  ]),
  { at: P, z: plateTop, carrier: 'mainplate' },
  { at: P, z: LEVELS.palletCock[1], carrier: 'palletCock' },
  { at: B, z: plateTop - 0.08, carrier: 'mainplate' },
  { at: B, z: LEVELS.balanceCock[1], carrier: 'balanceCock' },
];

/** Cap jewels sit over the balance hole jewels (a second, flat stone). */
export const CAP_JEWELS: readonly JewelSpec[] = [
  { at: B, z: plateTop - 0.09, carrier: 'mainplate' },
  { at: B, z: LEVELS.balanceCock[1] + 0.012, carrier: 'balanceCock' },
];

export const JEWEL_COUNT = JEWELS.length + CAP_JEWELS.length + 2 /* pallet stones */ + 1; /* impulse jewel */

/** Screws around the plate rim that clamp the movement into its case. */
export const RIM_SCREWS: readonly Vec2[] = [40, 160, 250, 320].map(deg => {
  const r = PLATE_RADIUS - 0.12;
  return [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r] as Vec2;
});

/** The train-bridge jewel over the third wheel doubles as the labelled "jewel bearing". */
export const FEATURED_JEWEL: JewelSpec = JEWELS.find(
  j => j.carrier === 'trainBridge' && j.at === arborById('third').position,
)!;

/** Click pivot on the barrel bridge, beside the ratchet rim. */
export const CLICK_PIVOT: Vec2 = [
  BARREL[0] + Math.cos((150 * Math.PI) / 180) * (WINDING.ratchetRadius + 0.2),
  BARREL[1] + Math.sin((150 * Math.PI) / 180) * (WINDING.ratchetRadius + 0.2),
];
