/**
 * The watch as you first see it: case, lugs, strap, bezel, crystal, dial and
 * hands. Hands are driven by the train (see simulation.handAngles).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import { LEVELS, WATCH } from '../movement/config';
import { getMaterials } from '../movement/materials';
import { caseProfiles, dauphineHand, lugGeometry, needleHand, planarUV, strapGeometry } from '../geometry/parts';
import { dialPrint } from '../movement/textures';
import { cylinder } from './Mechanics';

const TAU = Math.PI * 2;
const SUB_RADIUS = 0.44;
const DIAL_TOP = LEVELS.dial + 0.015;

export function CaseBody() {
  const m = getMaterials();
  const profiles = useMemo(caseProfiles, []);
  const lug = useMemo(lugGeometry, []);
  const straps = useMemo(() => [strapGeometry(1), strapGeometry(-1)], []);
  const lugX = 1.1;
  return (
    <group>
      <mesh geometry={profiles.middle} material={m.caseSteel} castShadow receiveShadow />
      <mesh geometry={profiles.back} material={m.caseBrushed} />
      {[1, -1].map(sy =>
        [lugX, -lugX].map(x => (
          <mesh key={`${sy}${x}`} geometry={lug} material={m.caseSteel} position={[x, 0, 0]} scale={[1, sy, 1]} castShadow />
        )),
      )}
      {straps.map((g, i) => (
        <mesh key={i} geometry={g} material={m.leather} castShadow receiveShadow />
      ))}
      {[1, -1].map(sy => (
        <mesh key={sy} geometry={cylinder(0.045, 2.2, 12)} material={m.steel} position={[0, sy * 3.08, 0.02]} rotation={[0, Math.PI / 2, 0]} />
      ))}
    </group>
  );
}

export function Bezel() {
  const m = getMaterials();
  const profiles = useMemo(caseProfiles, []);
  return <mesh geometry={profiles.bezel} material={m.caseSteel} castShadow />;
}

export function Crystal() {
  const m = getMaterials();
  const profiles = useMemo(caseProfiles, []);
  return (
    <group>
      <mesh geometry={profiles.crystal} material={m.glass} renderOrder={10} />
      <mesh geometry={profiles.crystalSeat} material={m.dark} />
    </group>
  );
}

function AppliedIndices() {
  const m = getMaterials();
  const baton = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.032, -0.14);
    s.lineTo(0.032, -0.14);
    s.lineTo(0.032, 0.14);
    s.lineTo(-0.032, 0.14);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  }, []);
  const r = 1.83;
  return (
    <group>
      {Array.from({ length: 12 }, (_, i) => {
        if (i === 6) return null;
        const a = (i / 12) * TAU;
        const offsets = i === 0 ? [-0.06, 0.06] : [0];
        return offsets.map(o => (
          <mesh
            key={`${i}${o}`}
            geometry={baton}
            material={m.applied}
            position={[Math.sin(a) * r + Math.cos(a) * o, Math.cos(a) * r - Math.sin(a) * o, DIAL_TOP]}
            rotation={[0, 0, -a]}
            castShadow
          />
        ));
      })}
    </group>
  );
}

export function Dial() {
  const m = getMaterials();
  const face = useMemo(() => new THREE.CircleGeometry(WATCH.dialRadius, 128), []);
  const edge = useMemo(() => new THREE.CylinderGeometry(WATCH.dialRadius, WATCH.dialRadius, 0.03, 128, 1, true).rotateX(Math.PI / 2), []);
  const sub = useMemo(() => planarUV(new THREE.RingGeometry(0.03, SUB_RADIUS, 96), SUB_RADIUS), []);
  const print = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: dialPrint({ subSecondsCentre: WATCH.subSeconds, subSecondsRadius: SUB_RADIUS - 0.03, dialRadius: WATCH.dialRadius }),
        transparent: true,
        roughness: 0.7,
        metalness: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  );
  const [sx, sy] = WATCH.subSeconds;
  return (
    <group>
      <mesh geometry={face} material={m.dial} position={[0, 0, DIAL_TOP]} receiveShadow />
      <mesh geometry={edge} material={m.dial} position={[0, 0, LEVELS.dial]} />
      <mesh geometry={sub} material={m.subDial} position={[sx, sy, DIAL_TOP + 0.001]} receiveShadow />
      <mesh geometry={face} material={print} position={[0, 0, DIAL_TOP + 0.002]} />
      <AppliedIndices />
    </group>
  );
}

type HandKind = 'hour' | 'minute' | 'second';

export function Hand({ kind, story }: { kind: HandKind; story: Story }) {
  const m = getMaterials();
  const rotor = useRef<THREE.Group>(null!);
  const geometry = useMemo(() => {
    if (kind === 'hour') return dauphineHand(1.28, 0.085, 0.2, 0.03);
    if (kind === 'minute') return dauphineHand(1.98, 0.068, 0.24, 0.028);
    return needleHand(0.4, 0.012, 0.1, 0.03);
  }, [kind]);
  const centre = kind === 'second' ? WATCH.subSeconds : ([0, 0] as const);
  useFrame(() => {
    // Hands turn clockwise seen from the dial; the geometry points at twelve.
    rotor.current.rotation.z = story.mech.hands[kind];
  });
  const z = kind === 'hour' ? 0.03 : kind === 'minute' ? 0.058 : 0.02;
  return (
    <group position={[centre[0], centre[1], DIAL_TOP + z]}>
      <group ref={rotor}>
        <mesh geometry={geometry} material={kind === 'second' ? m.giltPolished : m.handSteel} castShadow />
      </group>
      <mesh
        geometry={cylinder(kind === 'second' ? 0.035 : kind === 'hour' ? 0.09 : 0.065, 0.03, 24)}
        material={kind === 'second' ? m.giltPolished : m.applied}
        position={[0, 0, 0.012]}
      />
    </group>
  );
}
