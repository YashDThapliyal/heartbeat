/**
 * A story-driven component. Places its children between assembled, exploded,
 * opened and stacked transforms, and animates its own material copies for
 * focus, glow, fades, hover and selection.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import type { ExteriorGroup } from '../animation/timeline';
import { stagger } from '../animation/tracks';
import { smootherstep } from '../movement/simulation';
import { emphasisFor, type Behaviour, type Emphasis, type FocusGroup } from '../animation/emphasis';
import type { PartId } from '../movement/catalog';
import { registerAnchor, type LabelSet } from './labelRegistry';

type Triple = readonly [number, number, number];

export interface ExplodeSpec {
  offset: Triple;
  /** 0 = first to leave (and last to return), 1 = last to leave. */
  order: number;
}

export interface ExteriorSpec {
  group: ExteriorGroup;
  opened: Triple;
  openedRotation?: Triple;
  stacked: Triple;
}

export interface LabelSpec {
  anchor: Triple;
  sets: readonly LabelSet[];
}

export interface PartProps {
  id: PartId;
  story: Story;
  groups?: readonly FocusGroup[];
  trainIndex?: number;
  behaviour?: Behaviour;
  position?: Triple;
  explode?: ExplodeSpec;
  exterior?: ExteriorSpec;
  label?: LabelSpec;
  selectable?: boolean;
  children: ReactNode;
  onSelect?: (id: PartId) => void;
}

interface MaterialSlot {
  base: THREE.MeshStandardMaterial;
  clone: THREE.MeshStandardMaterial;
}

const GLOW = new THREE.Color('#ff9a45');
/** Share of an exterior part's opening spent lifting straight up, and how high. */
const RISE_SHARE = 0.4;
const RISE_HEIGHT = 0.9;
const NO_GROUPS: readonly FocusGroup[] = [];

function adoptMaterials(root: THREE.Object3D): MaterialSlot[] {
  const clones = new Map<THREE.Material, MaterialSlot>();
  const cloneOf = (m: THREE.Material): THREE.Material => {
    if (!(m instanceof THREE.MeshStandardMaterial)) return m;
    let slot = clones.get(m);
    if (!slot) {
      slot = { base: m, clone: m.clone() };
      clones.set(m, slot);
    }
    return slot.clone;
  };
  root.traverse(obj => {
    if (!(obj instanceof THREE.Mesh) || obj.userData.keepMaterial) return;
    obj.material = Array.isArray(obj.material) ? obj.material.map(cloneOf) : cloneOf(obj.material);
  });
  return [...clones.values()];
}

export function Part(props: PartProps) {
  const { id, story, groups = NO_GROUPS, trainIndex, behaviour = 'none', position, explode, exterior, label } = props;
  const selectable = props.selectable ?? true;
  const root = useRef<THREE.Group>(null!);
  const anchor = useRef<THREE.Group>(null);
  const slots = useRef<MaterialSlot[] | null>(null);
  const emphasis = useRef<Emphasis>({ brightness: 1, glow: 0, opacity: 1, lift: 0 });
  const traits = useRef({ id, groups, trainIndex, behaviour });
  traits.current = { id, groups, trainIndex, behaviour };

  useEffect(() => {
    if (!label || !anchor.current) return;
    return registerAnchor(id, anchor.current, label.sets);
  }, [id, label]);

  useEffect(
    () => () => {
      slots.current?.forEach(s => s.clone.dispose());
      slots.current = null;
    },
    [],
  );

  useFrame(() => {
    const g = root.current;
    // Children attach during commit; adopt their materials on the first frame.
    if (!slots.current) slots.current = adoptMaterials(g);

    const f = story.frame;
    const e = emphasisFor(traits.current, story, emphasis.current);
    const base = position ?? [0, 0, 0];
    let x = base[0];
    let y = base[1];
    let z = base[2] + e.lift;
    let rx = 0;
    let ry = 0;
    let rz = 0;

    if (explode) {
      const global = story.explore ? story.controls.explode : f.explode;
      const k = stagger(global, explode.order) * (story.reduced ? 0.6 : 1);
      x += explode.offset[0] * k;
      y += explode.offset[1] * k;
      z += explode.offset[2] * k;
    }
    if (exterior) {
      const open = story.explore ? (exterior.group === 'dial' || exterior.group === 'hands' ? 0 : 1) : f.open[exterior.group];
      const stack = story.explore
        ? exterior.group === 'dial' || exterior.group === 'hands'
          ? 0.6 + story.controls.explode * 0.4
          : 0
        : f.stack[exterior.group];
      // Each piece first rises straight off the watch, then glides aside.
      const rise = smootherstep(open / RISE_SHARE);
      const glide = smootherstep((open - RISE_SHARE * 0.6) / (1 - RISE_SHARE * 0.6));
      x += exterior.opened[0] * glide + exterior.stacked[0] * stack;
      y += exterior.opened[1] * glide + exterior.stacked[1] * stack;
      z += RISE_HEIGHT * rise * (1 - glide) + exterior.opened[2] * glide + exterior.stacked[2] * stack;
      if (exterior.openedRotation) {
        rx = exterior.openedRotation[0] * glide;
        ry = exterior.openedRotation[1] * glide;
        rz = exterior.openedRotation[2] * glide;
      }
    }
    g.position.set(x, y, z);
    g.rotation.set(rx, ry, rz);
    g.visible = e.opacity > 0.004;

    for (const { base: b, clone: c } of slots.current) {
      c.color.copy(b.color).multiplyScalar(e.brightness);
      c.envMapIntensity = b.envMapIntensity * e.brightness;
      c.emissive.copy(b.emissive);
      c.emissiveIntensity = b.emissiveIntensity * e.brightness;
      if (e.glow > 0) {
        c.emissive.lerp(GLOW, Math.min(1, e.glow * 4));
        c.emissiveIntensity = Math.max(c.emissiveIntensity, e.glow * 1.4);
      }
      const opacity = b.opacity * e.opacity;
      const fading = opacity < 0.999;
      const transparent = b.transparent || fading;
      c.opacity = opacity;
      // Opaque materials compile with alpha forced to 1, so switching needs a
      // program swap (both variants are cached after first use).
      if (c.transparent !== transparent) {
        c.transparent = transparent;
        c.needsUpdate = true;
      }
      c.depthWrite = b.depthWrite && !fading;
    }
  });

  const interactive = () => story.explore || story.frame.hoverable;
  const over = (event: ThreeEvent<PointerEvent>) => {
    if (!selectable || !interactive()) return;
    event.stopPropagation();
    story.hovered = id;
    document.body.style.cursor = 'pointer';
  };
  const out = () => {
    if (story.hovered !== id) return;
    story.hovered = null;
    document.body.style.cursor = '';
  };
  const click = (event: ThreeEvent<MouseEvent>) => {
    if (!selectable || !story.explore) return;
    event.stopPropagation();
    props.onSelect?.(id);
  };

  return (
    <group ref={root} name={id} onPointerOver={over} onPointerOut={out} onClick={click}>
      {props.children}
      {label && <group ref={anchor} position={[...label.anchor]} />}
    </group>
  );
}
