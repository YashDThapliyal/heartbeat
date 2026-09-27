/**
 * Shared small parts (screws, jewels, arbors) and the rotating train arbors.
 * Geometries are cached so repeated parts share GPU buffers.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import { angularVelocity, smoothstep } from '../movement/simulation';
import { getMaterials } from '../movement/materials';
import { createEscapeWheel, createPinion, createWheel } from '../geometry/gear';
import { chaton, jewelStone, planarUV, screwHead } from '../geometry/parts';
import { ESCAPEMENT, type Arbor, type Vec3 } from '../movement/config';

const cache = new Map<string, THREE.BufferGeometry>();
export function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g as T;
}

const box = (w: number, h: number, d: number) => cached(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cylinder = (r: number, h: number, seg = 24) =>
  cached(`cyl:${r}:${h}:${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2));

interface ScrewProps {
  position: Vec3;
  radius?: number;
  blued?: boolean;
}

/** Slotted screw with a domed head; slot angle varies like hand-tightened screws. */
export function Screw({ position, radius = 0.075, blued = true }: ScrewProps) {
  const m = getMaterials();
  const head = cached(`screw:${radius}`, () => screwHead(radius, radius * 0.55));
  const slotAngle = useMemo(() => (Math.sin(position[0] * 91.7 + position[1] * 57.3) * 0.5 + 0.5) * Math.PI, [position]);
  return (
    <group position={position}>
      <mesh geometry={head} material={blued ? m.blued : m.steel} castShadow />
      <mesh
        geometry={box(radius * 2.05, radius * 0.22, radius * 0.4)}
        material={m.dark}
        position={[0, 0, radius * 0.55]}
        rotation={[0, 0, slotAngle]}
      />
    </group>
  );
}

interface JewelProps {
  position: Vec3;
  radius?: number;
  cap?: boolean;
}

/** Ruby in a polished gold chaton. */
export function Jewel({ position, radius = 0.065, cap = false }: JewelProps) {
  const m = getMaterials();
  const setting = cached(`chaton:${radius}`, () => chaton(radius, radius * 0.62, 0.02));
  const stone = cached(`stone:${radius}:${cap}`, () =>
    cap ? jewelStone(radius * 0.6, 0.001, 0.014) : jewelStone(radius * 0.62, radius * 0.1, 0.018),
  );
  return (
    <group position={position}>
      {!cap && <mesh geometry={setting} material={m.gold} />}
      <mesh geometry={stone} material={m.ruby} position={[0, 0, cap ? 0 : 0.004]} />
    </group>
  );
}

/** Polished steel arbor between two heights. */
export function Staff({ from, to, radius = 0.018 }: { from: number; to: number; radius?: number }) {
  return <mesh geometry={cylinder(radius, to - from, 12)} material={getMaterials().steel} position={[0, 0, (from + to) / 2]} />;
}

/** Display angular speed above which a wheel reads as a blur. */
function blurAmount(speed: number): number {
  return smoothstep((speed - 14) / 16);
}

interface TrainArborProps {
  arbor: Arbor;
  story: Story;
  /** Heights the arbor spans (plate to bridge, or beyond for hand arbors). */
  staff: readonly [number, number];
}

/** A train wheel with its pinion and arbor, turning at the simulated angle. */
export function TrainArbor({ arbor, story, staff }: TrainArborProps) {
  const m = getMaterials();
  const rotor = useRef<THREE.Group>(null!);
  const sharp = useRef<THREE.Mesh>(null!);
  const blurRing = useRef<THREE.Mesh>(null!);
  const isEscape = arbor.id === 'escape';
  const w = arbor.wheel;

  const wheel = useMemo(
    () =>
      isEscape
        ? createEscapeWheel({
            teeth: w.teeth,
            tipRadius: ESCAPEMENT.tipRadius,
            rootRadius: ESCAPEMENT.rootRadius,
            thickness: w.thickness,
            spokes: w.spokes,
          })
        : planarUV(
            createWheel({ teeth: w.teeth, pitchRadius: w.pitchRadius, thickness: w.thickness, spokes: w.spokes, bevel: 0.006 }),
            w.pitchRadius * 1.1,
          ),
    [isEscape, w],
  );
  const pinion = useMemo(
    () => (arbor.pinion ? createPinion(arbor.pinion.leaves, arbor.pinion.pitchRadius, arbor.pinion.length) : null),
    [arbor.pinion],
  );
  const blurGeometry = useMemo(() => {
    const outer = isEscape ? ESCAPEMENT.tipRadius : w.pitchRadius;
    return new THREE.RingGeometry(outer * 0.62, outer, 64);
  }, [isEscape, w.pitchRadius]);
  const blurMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: isEscape ? '#c4c8cc' : '#d8b576',
        metalness: 1,
        roughness: 0.45,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [isEscape],
  );

  useFrame(() => {
    rotor.current.rotation.z = story.mech.angles[arbor.id];
    const speed = Math.abs(angularVelocity(arbor.id) * story.mech.rate);
    const blur = blurAmount(speed);
    sharp.current.visible = blur < 0.6;
    blurRing.current.visible = blur > 0.02;
    blurMaterial.opacity = Math.min(0.12, blur * 0.16);
  });

  return (
    <group>
      <Staff from={staff[0]} to={staff[1]} />
      <group ref={rotor}>
        <mesh ref={sharp} geometry={wheel} material={isEscape ? m.escapeSteel : [m.giltWheel, m.gilt]} position={[0, 0, w.z]} castShadow receiveShadow />
        <mesh ref={blurRing} geometry={blurGeometry} material={blurMaterial} position={[0, 0, w.z]} userData={{ keepMaterial: true }} />
        {pinion && arbor.pinion && <mesh geometry={pinion} material={m.steel} position={[0, 0, arbor.pinion.z]} castShadow />}
        <mesh geometry={cylinder(isEscape ? 0.05 : Math.max(0.045, w.pitchRadius * 0.14), w.thickness + 0.02, 24)} material={m.giltPolished} position={[0, 0, w.z]} />
      </group>
    </group>
  );
}
