/**
 * Parts register a 3D anchor for their annotation; the label overlay projects
 * whichever anchors the current chapter asks for.
 */
import type * as THREE from 'three';
import type { PartId } from '../movement/catalog';

export type LabelSet = 'anatomy' | 'winding' | 'escapement' | 'balance' | 'explore';

export interface LabelAnchor {
  id: PartId;
  object: THREE.Object3D;
  sets: readonly LabelSet[];
}

const anchors = new Map<PartId, LabelAnchor>();

export function registerAnchor(id: PartId, object: THREE.Object3D, sets: readonly LabelSet[]): () => void {
  anchors.set(id, { id, object, sets });
  return () => {
    if (anchors.get(id)?.object === object) anchors.delete(id);
  };
}

export type CalloutId = 'entry' | 'exit' | 'pin';

/** Named anchors for the escapement callouts (stones and impulse pin). */
export const CALLOUT_ANCHORS: Partial<Record<CalloutId, THREE.Object3D>> = {};

export function registerCallout(id: CalloutId, object: THREE.Object3D): () => void {
  CALLOUT_ANCHORS[id] = object;
  return () => {
    if (CALLOUT_ANCHORS[id] === object) delete CALLOUT_ANCHORS[id];
  };
}

/** Iterate anchors without allocating. */
export function forEachAnchor(visit: (anchor: LabelAnchor) => void): void {
  anchors.forEach(visit);
}
