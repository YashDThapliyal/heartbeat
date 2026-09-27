/**
 * The single mutable store shared by the scene and the UI. The render loop
 * writes it; components read it inside useFrame. React state is only used for
 * coarse UI changes (chapter, explore mode), never per frame.
 */
import { createFrame, type StoryFrame } from './timeline';
import { createInteraction, type Interaction } from './interaction';
import type { PartId } from '../movement/catalog';
import {
  escapementAt,
  handAngles,
  meshPhaseOffsets,
  trainAngles,
  windingAngles,
  type ArborAngles,
  type EscapementState,
  type HandAngles,
  type WindingAngles,
} from '../movement/simulation';

export type Quality = 'high' | 'low';

export interface MechState {
  escapement: EscapementState;
  angles: ArborAngles;
  hands: HandAngles;
  winding: WindingAngles;
  /** Simulated seconds per real second, after story and user speed controls. */
  rate: number;
  /** 0 = crisp stepping, 1 = beats too fast to see (use averaged motion). */
  beatBlur: number;
}

export interface ExploreControls {
  playing: boolean;
  speed: number;
  explode: number;
  labels: boolean;
}

/** Free rotation the viewer applies by dragging the watch on the opening screens. */
export interface Spin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dragging: boolean;
  /** The pointer is over the watch (on the opening screens, a click opens it). */
  overWatch: boolean;
}

export interface Story {
  /** Smoothed story progress, and where the scroll position wants it. */
  p: number;
  targetP: number;
  /** Simulation clock: seconds after local midnight. */
  time: number;
  frame: StoryFrame;
  mech: MechState;
  explore: boolean;
  controls: ExploreControls;
  selected: PartId | null;
  hovered: PartId | null;
  reduced: boolean;
  quality: Quality;
  portrait: boolean;
  /** Seconds since the scene became ready (for idle motion). */
  elapsed: number;
  spin: Spin;
  /** The viewer's own winding and ticking. */
  interact: Interaction;
  /** The guided tour is playing (the page shows less at once). */
  touring: boolean;
}

export const MESH_OFFSETS = meshPhaseOffsets();

function secondsAfterMidnight(): number {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
}

export function createStory(): Story {
  const time = secondsAfterMidnight();
  const escapement = escapementAt(time);
  const angles = trainAngles(escapement.escapeAngle, MESH_OFFSETS);
  const frame = createFrame();
  return {
    p: 0,
    targetP: 0,
    time,
    frame,
    mech: {
      escapement,
      angles,
      hands: handAngles(angles, MESH_OFFSETS),
      winding: windingAngles(frame.winding),
      rate: 1,
      beatBlur: 0,
    },
    explore: false,
    controls: { playing: true, speed: 1, explode: 0.35, labels: true },
    selected: null,
    hovered: null,
    reduced: false,
    quality: 'high',
    portrait: false,
    elapsed: 0,
    spin: { x: 0, y: 0, vx: 0, vy: 0, dragging: false, overWatch: false },
    interact: createInteraction(),
    touring: false,
  };
}
