/**
 * The story state: every value here is a pure function of scroll progress p.
 * Scrolling backward replays everything in reverse, exactly.
 */
import { INTRO } from './chapters';
import { smootherstep } from '../movement/simulation';
import { logTrack, pulse, scalarTrack, vecTrack, type Key, type Vec3Tuple } from './tracks';

export interface Shot {
  camera: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  /** Horizontal composition offset as a fraction of view width (+ = subject right). */
  frameX: number;
}

/** Exterior groups that leave (open) and later stack into the exploded poster. */
export type ExteriorGroup = 'glass' | 'bezel' | 'hands' | 'dial' | 'case';
export const EXTERIOR_GROUPS: readonly ExteriorGroup[] = ['glass', 'bezel', 'hands', 'dial', 'case'];

export interface StoryFrame {
  shot: Shot;
  open: Record<ExteriorGroup, number>;
  stack: Record<ExteriorGroup, number>;
  explode: number;
  bridgesAway: number;
  barrelOpen: number;
  isolate: number;
  balanceLift: number;
  dialGhost: number;
  /** Mainspring tightness: 0 = let down, 1 = fully wound. */
  wind: number;
  /** Crown/ratchet turning progress (only ever increases within the chapter). */
  winding: number;
  timeScale: number;
  bulletTime: number;
  /** Depth-of-field strength for macro shots (0 = everything sharp). */
  dof: number;
  /** Energy position along the train: 0 = barrel … 4 = escape wheel. */
  energy: number;
  focus: {
    winding: number;
    train: number;
    escapement: number;
    balance: number;
    display: number;
  };
  labels: { anatomy: number; winding: number; escapement: number; balance: number };
  hoverable: boolean;
  /** Which hands-on moment, if any, the viewer can perform right now. */
  handsOn: HandsOn | null;
}

export type HandsOn = 'wind' | 'tick';

/** Story-unit windows for the hands-on moments. */
export const HANDS_ON = { wind: [3.36, 3.9] as const, tick: [5.96, 6.6] as const };

// ——— Camera ————————————————————————————————————————————————————————————
// Positions are in the watch's own frame: +Z out of the dial, +Y toward twelve.

interface ShotSpec {
  camera: Vec3Tuple;
  target: Vec3Tuple;
  up: Vec3Tuple;
  fov: number;
  frameX: number;
}

const UP: Vec3Tuple = [0, 1, 0];
const UP_Z: Vec3Tuple = [0, 0.18, 1];
/** Rolled so the escapement's line of centres runs up the screen, leaning right. */
const ESCAPE_UP: Vec3Tuple = [-0.766, 0.643, 0.45];

/** Opening frame: the watch alone, centred, a little further away. */
const INTRO_SHOT: ShotSpec = { camera: [2.1, -2.9, 17.2], target: [0, -0.05, 0.2], up: UP, fov: 30, frameX: 0 };
const HERO: ShotSpec = { camera: [3.2, -3.4, 15.2], target: [0, -0.1, 0.2], up: UP, fov: 30, frameX: 0.19 };
const APPROACH: ShotSpec = { camera: [1.9, -2.3, 12.4], target: [0, -0.05, 0.4], up: UP, fov: 30, frameX: 0.18 };
const REVEAL: ShotSpec = { camera: [0.7, -2.2, 10.6], target: [0, 0, 0.35], up: UP, fov: 30, frameX: 0.18 };
const EXPLODED: ShotSpec = { camera: [8.6, -9.4, 8.2], target: [0, 0, 1.15], up: UP_Z, fov: 30, frameX: 0.17 };
const BARREL: ShotSpec = { camera: [4.3, -3.9, 6.3], target: [1.5, 0.3, 0.5], up: UP, fov: 30, frameX: 0.1 };
const TRAIN_A: ShotSpec = { camera: [1.6, -2.4, 6.4], target: [0.25, 0.35, 0.2], up: UP, fov: 30, frameX: 0.17 };
const TRAIN_B: ShotSpec = { camera: [0.9, -3.8, 6.2], target: [-0.1, -0.55, 0.2], up: UP, fov: 30, frameX: 0.17 };
const ESCAPE_WIDE: ShotSpec = { camera: [1.25, -2.35, 4.6], target: [-0.72, -0.5, 0.3], up: ESCAPE_UP, fov: 30, frameX: 0.15 };
const ESCAPE_MACRO: ShotSpec = { camera: [0.17, -1.35, 3.0], target: [-0.79, -0.55, 0.26], up: ESCAPE_UP, fov: 30, frameX: 0.14 };
const BALANCE_MACRO: ShotSpec = { camera: [0.05, -1.3, 3.25], target: [-1.19, 0.15, 0.78], up: ESCAPE_UP, fov: 30, frameX: 0.15 };
const DISPLAY: ShotSpec = { camera: [6.6, -8.4, 4.9], target: [-0.1, -0.2, 1.35], up: UP_Z, fov: 30, frameX: 0.16 };
const POSTER: ShotSpec = { camera: [11.8, -13.2, 8.6], target: [0, 0, 1.15], up: UP_Z, fov: 30, frameX: 0.12 };

type ShotKey = readonly [number, ShotSpec];

const SHOTS: readonly ShotKey[] = [
  [0, HERO],
  [0.35, HERO],
  [0.95, APPROACH],
  [1.72, REVEAL],
  [1.9, REVEAL],
  [2.45, EXPLODED],
  [2.95, EXPLODED],
  [3.35, BARREL],
  [4.05, BARREL],
  [4.35, TRAIN_A],
  [4.6, TRAIN_A],
  [5.1, TRAIN_B],
  [5.3, TRAIN_B],
  [5.62, ESCAPE_WIDE],
  [5.92, ESCAPE_MACRO],
  [6.62, ESCAPE_MACRO],
  [6.98, BALANCE_MACRO],
  [7.46, BALANCE_MACRO],
  [7.85, DISPLAY],
  [8.26, DISPLAY],
  [8.58, POSTER],
  [8.72, POSTER],
  [9.22, HERO],
  [9.4, HERO],
];

const cameraTrack = vecTrack(SHOTS.map(([at, s]) => [at, s.camera] as Key<Vec3Tuple>));
const targetTrack = vecTrack(SHOTS.map(([at, s]) => [at, s.target] as Key<Vec3Tuple>));
const upTrack = vecTrack(SHOTS.map(([at, s]) => [at, s.up] as Key<Vec3Tuple>));
const fovTrack = scalarTrack(SHOTS.map(([at, s]) => [at, s.fov] as Key<number>));
const frameTrack = scalarTrack(SHOTS.map(([at, s]) => [at, s.frameX] as Key<number>));

// ——— Exterior: open (fly aside) and stack (exploded poster) ———————————————————

/**
 * The watch opens one piece at a time, each finishing before the next begins:
 * crystal, bezel, hands, dial, then the case falls away.
 */
const openTracks: Record<ExteriorGroup, (p: number) => number> = {
  glass: scalarTrack([[0.8, 0], [0.98, 1], [8.3, 1], [8.62, 0]]),
  bezel: scalarTrack([[1.0, 0], [1.16, 1], [8.3, 1], [8.62, 0]]),
  hands: scalarTrack([[1.2, 0], [1.36, 1], [7.55, 1], [7.95, 0]]),
  dial: scalarTrack([[1.4, 0], [1.58, 1], [7.55, 1], [7.95, 0]]),
  case: scalarTrack([[1.62, 0], [1.8, 1], [8.3, 1], [8.62, 0]]),
};

const stackTracks: Record<ExteriorGroup, (p: number) => number> = {
  glass: scalarTrack([[8.3, 0], [8.62, 1], [8.98, 1], [9.2, 0]]),
  bezel: scalarTrack([[8.3, 0], [8.62, 1], [8.98, 1], [9.2, 0]]),
  hands: scalarTrack([[7.55, 0], [7.95, 0.42], [8.3, 0.42], [8.62, 1], [8.95, 1], [9.14, 0]]),
  dial: scalarTrack([[7.55, 0], [7.95, 0.42], [8.3, 0.42], [8.62, 1], [8.9, 1], [9.08, 0]]),
  case: scalarTrack([[8.3, 0], [8.62, 1], [8.78, 1], [8.98, 0]]),
};

// ——— Movement channels ——————————————————————————————————————————————————

const explodeTrack = scalarTrack([
  [1.92, 0],
  [2.42, 1],
  [2.9, 1],
  [3.3, 0],
  [8.3, 0],
  [8.6, 1],
  [8.72, 1],
  [9.1, 0],
]);

const bridgesAwayTrack = pulse(2.95, 3.3, 7.5, 7.88);
const barrelOpenTrack = pulse(3.14, 3.36, 4.02, 4.25);
const isolateTrack = pulse(5.36, 5.72, 7.42, 7.7);
const balanceLiftTrack = pulse(6.66, 6.98, 7.4, 7.62);
const dialGhostTrack = pulse(7.55, 7.9, 8.6, 9.05);

const windTrack = scalarTrack([
  [3.02, 0.72],
  [3.12, 0.06],
  // Held let-down while the viewer winds; scrolling on finishes the job.
  [3.8, 0.06],
  [4.0, 1, 'linear'],
]);
/** Crown/ratchet progress, as a fraction of a full wind. Matches the spring's rise
 *  from 0.06 to 1, so each arbor turn adds exactly one coil and the drum hook stays put. */
const windingTrack = scalarTrack([
  [3.8, 0],
  [4.0, 0.94, 'linear'],
]);

/**
 * Simulation speed. The train chapter is a time-lapse that slows as energy
 * travels downstream, so each wheel is shown at a readable speed. The
 * escapement is then shown in slow motion.
 */
const timeScaleTrack = logTrack([
  [4.12, 1],
  [4.26, 1200],
  [4.42, 1200],
  [4.62, 240],
  [4.82, 40],
  [5.02, 6],
  [5.2, 1],
  [5.36, 1],
  [5.72, 0.07],
  [6.62, 0.07],
  [6.9, 0.16],
  [7.46, 0.16],
  [7.62, 1],
  [7.92, 60],
  [8.26, 60],
  [8.36, 1],
]);

const bulletTimeTrack = pulse(5.6, 5.8, 6.6, 6.7);

const dofTrack = scalarTrack([
  [3.2, 0],
  [3.42, 0.55],
  [4.02, 0.55],
  [4.25, 0],
  [5.5, 0],
  [5.92, 1],
  [7.46, 1],
  [7.7, 0],
]);

const energyTrack = scalarTrack([
  [4.26, 0],
  [4.42, 0],
  [4.62, 1],
  [4.82, 2],
  [5.02, 3],
  [5.2, 4],
]);

const focusTracks = {
  winding: pulse(3.05, 3.3, 4.02, 4.2),
  train: pulse(4.14, 4.3, 5.26, 5.45),
  escapement: pulse(5.36, 5.62, 6.62, 6.78),
  balance: pulse(6.66, 6.9, 7.44, 7.62),
  display: pulse(7.62, 7.92, 8.24, 8.36),
};

const labelTracks = {
  anatomy: pulse(2.34, 2.46, 2.86, 2.95),
  winding: pulse(3.3, 3.42, 3.98, 4.06),
  escapement: pulse(5.88, 5.98, 6.58, 6.64),
  balance: pulse(6.95, 7.05, 7.4, 7.46),
};

function copyShot(src: ShotSpec, dst: Shot): void {
  dst.camera = [...src.camera];
  dst.target = [...src.target];
  dst.up = [...src.up];
  dst.fov = src.fov;
  dst.frameX = src.frameX;
}

export function createFrame(): StoryFrame {
  const shot: Shot = { camera: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], fov: 30, frameX: 0 };
  copyShot(INTRO_SHOT, shot);
  const zeros = (): Record<ExteriorGroup, number> => ({ glass: 0, bezel: 0, hands: 0, dial: 0, case: 0 });
  return {
    shot,
    open: zeros(),
    stack: zeros(),
    explode: 0,
    bridgesAway: 0,
    barrelOpen: 0,
    isolate: 0,
    balanceLift: 0,
    dialGhost: 0,
    wind: 0.72,
    winding: 0,
    timeScale: 1,
    bulletTime: 0,
    dof: 0,
    energy: 0,
    focus: { winding: 0, train: 0, escapement: 0, balance: 0, display: 0 },
    labels: { anatomy: 0, winding: 0, escapement: 0, balance: 0 },
    hoverable: false,
    handsOn: null,
  };
}

/** Blend the opening frame into the hero composition as the first scroll begins. */
function applyIntro(p: number, shot: Shot): void {
  const t = smootherstep((p - 0.03) / (INTRO - 0.03));
  if (t >= 1) return;
  const mix3 = (a: Vec3Tuple, out: [number, number, number]) => {
    for (let i = 0; i < 3; i++) out[i] = a[i] + (out[i] - a[i]) * t;
  };
  mix3(INTRO_SHOT.camera, shot.camera);
  mix3(INTRO_SHOT.target, shot.target);
  shot.frameX = INTRO_SHOT.frameX + (shot.frameX - INTRO_SHOT.frameX) * t;
}

/**
 * Writes the story state for page progress p into `frame` (no allocation).
 * Tracks are authored in story units, which begin after the intro.
 */
export function sampleFrame(pageP: number, frame: StoryFrame): StoryFrame {
  const p = pageP - INTRO;
  cameraTrack(p, frame.shot.camera);
  targetTrack(p, frame.shot.target);
  upTrack(p, frame.shot.up);
  frame.shot.fov = fovTrack(p);
  frame.shot.frameX = frameTrack(p);
  for (const g of EXTERIOR_GROUPS) {
    frame.open[g] = openTracks[g](p);
    frame.stack[g] = stackTracks[g](p);
  }
  frame.explode = explodeTrack(p);
  frame.bridgesAway = bridgesAwayTrack(p);
  frame.barrelOpen = barrelOpenTrack(p);
  frame.isolate = isolateTrack(p);
  frame.balanceLift = balanceLiftTrack(p);
  frame.dialGhost = dialGhostTrack(p);
  frame.wind = windTrack(p);
  frame.winding = windingTrack(p);
  frame.timeScale = timeScaleTrack(p);
  frame.bulletTime = bulletTimeTrack(p);
  frame.dof = dofTrack(p);
  frame.energy = energyTrack(p);
  frame.focus.winding = focusTracks.winding(p);
  frame.focus.train = focusTracks.train(p);
  frame.focus.escapement = focusTracks.escapement(p);
  frame.focus.balance = focusTracks.balance(p);
  frame.focus.display = focusTracks.display(p);
  frame.labels.anatomy = labelTracks.anatomy(p);
  frame.labels.winding = labelTracks.winding(p);
  frame.labels.escapement = labelTracks.escapement(p);
  frame.labels.balance = labelTracks.balance(p);
  frame.hoverable = p > 2.4 && p < 2.92;
  frame.handsOn = p >= HANDS_ON.wind[0] && p < HANDS_ON.wind[1] ? 'wind' : p >= HANDS_ON.tick[0] && p < HANDS_ON.tick[1] ? 'tick' : null;
  applyIntro(pageP, frame.shot);
  return frame;
}

export const HERO_SHOT: ShotSpec = HERO;
