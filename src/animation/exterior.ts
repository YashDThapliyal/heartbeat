/**
 * Where the exterior parts go when the watch opens (well clear of every later
 * shot) and where they sit in the exploded "poster" stack of the finale.
 */
import type { ExteriorSpec } from '../components/Part';

export const EXTERIOR = {
  case: { group: 'case', opened: [0, -14, -8], openedRotation: [-0.5, 0, 0], stacked: [0, 0, -2.1] },
  bezel: { group: 'bezel', opened: [8, 13, 6], openedRotation: [0.6, 0.4, 0], stacked: [0, 0, 3.9] },
  crystal: { group: 'glass', opened: [-5, 14, 8], openedRotation: [0.7, -0.3, 0], stacked: [0, 0, 4.35] },
  dial: { group: 'dial', opened: [-14, 3, 5], openedRotation: [0, -0.9, -0.2], stacked: [0, 0, 3.0] },
  hands: { group: 'hands', opened: [-10, 12, 7], openedRotation: [0.3, 0, 0.4], stacked: [0, 0, 3.45] },
} as const satisfies Record<string, ExteriorSpec>;
