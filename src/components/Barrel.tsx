/**
 * Energy storage and winding: the barrel with its mainspring, and the chain
 * crown → stem → winding pinion → crown wheel → ratchet → barrel arbor.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import { BARREL_SPEC, WINDING, arborById } from '../movement/config';
import { getMaterials } from '../movement/materials';
import { TAU, mix } from '../movement/simulation';
import { createKnurledCylinder, createPinion, createWheel } from '../geometry/gear';
import { planarUV, turned } from '../geometry/parts';
import { SpiralRibbon } from '../geometry/spiral';
import { Screw, Staff, cylinder } from './Mechanics';

interface Props {
  story: Story;
}

const barrel = arborById('barrel');

export function BarrelDrum({ story }: Props) {
  const m = getMaterials();
  const drum = useRef<THREE.Group>(null!);
  const arbor = useRef<THREE.Group>(null!);
  const teeth = useMemo(
    () =>
      createWheel({
        teeth: barrel.wheel.teeth,
        pitchRadius: barrel.wheel.pitchRadius,
        thickness: barrel.wheel.thickness,
        spokes: 0,
        holeRadius: BARREL_SPEC.innerRadius,
      }),
    [],
  );
  const wall = useMemo(
    () =>
      turned([
        [BARREL_SPEC.innerRadius, BARREL_SPEC.topZ],
        [BARREL_SPEC.drumRadius, BARREL_SPEC.topZ],
        [BARREL_SPEC.drumRadius, BARREL_SPEC.bottomZ],
        [BARREL_SPEC.innerRadius, BARREL_SPEC.bottomZ],
        [BARREL_SPEC.innerRadius, BARREL_SPEC.topZ],
      ], 128),
    [],
  );
  const floor = useMemo(() => new THREE.CircleGeometry(BARREL_SPEC.innerRadius, 96), []);

  useFrame(() => {
    drum.current.rotation.z = story.mech.angles.barrel;
    arbor.current.rotation.z = story.mech.winding.ratchet;
  });

  return (
    <group>
      <group ref={drum}>
        <mesh geometry={teeth} material={m.gilt} position={[0, 0, barrel.wheel.z]} castShadow receiveShadow />
        <mesh geometry={wall} material={m.gilt} castShadow receiveShadow />
        <mesh geometry={floor} material={m.plateSink} position={[0, 0, BARREL_SPEC.bottomZ + 0.012]} receiveShadow />
      </group>
      <group ref={arbor}>
        <mesh geometry={cylinder(BARREL_SPEC.arborRadius, 0.3, 32)} material={m.steel} position={[0, 0, 0.25]} />
        <Staff from={0} to={WINDING.topZ} radius={0.05} />
      </group>
    </group>
  );
}

export function BarrelLid() {
  const m = getMaterials();
  const lid = useMemo(
    () =>
      planarUV(turned([
        [0.15, 0.02],
        [BARREL_SPEC.drumRadius - 0.01, 0.02],
        [BARREL_SPEC.drumRadius, 0.01],
        [BARREL_SPEC.drumRadius, 0],
        [0.15, 0],
        [0.15, 0.02],
      ], 128), BARREL_SPEC.drumRadius),
    [],
  );
  return <mesh geometry={lid} material={m.plateSide} position={[0, 0, BARREL_SPEC.topZ]} castShadow />;
}

const SPRING_SAMPLES = 1000;
const INNER = BARREL_SPEC.arborRadius + 0.012;
const OUTER = BARREL_SPEC.innerRadius - 0.012;
const PITCH = 0.018;
const BASE_TURNS = 6;

/**
 * Mainspring: inner end hooked to the arbor, outer end to the drum wall.
 * Winding adds one coil per arbor turn and packs the coils around the arbor;
 * let down, they relax outward against the wall.
 */
export function Mainspring({ story }: Props) {
  const m = getMaterials();
  const ribbon = useMemo(() => new SpiralRibbon({ samples: SPRING_SAMPLES, width: 0.012, height: 0.27 }), []);
  const radii = useMemo(() => new Float32Array(SPRING_SAMPLES + 1), []);
  const key = useRef('');
  useEffect(() => () => ribbon.dispose(), [ribbon]);

  useFrame(() => {
    const wind = story.explore ? 0.85 : story.frame.wind;
    const inner = story.mech.winding.ratchet;
    const drum = story.mech.angles.barrel;
    const k = `${wind.toFixed(4)}:${inner.toFixed(4)}:${drum.toFixed(4)}`;
    if (k === key.current) return;
    key.current = k;

    const turns = BASE_TURNS + WINDING.barrelTurnsFull * wind;
    const packing = mix(0.45, 3.6, wind);
    const perTurn = Math.round(SPRING_SAMPLES / turns);
    for (let i = 0; i <= SPRING_SAMPLES; i++) radii[i] = INNER + (OUTER - INNER) * Math.pow(i / SPRING_SAMPLES, packing);
    // Coils may touch but never cross: one pitch between neighbouring turns.
    for (let i = perTurn; i <= SPRING_SAMPLES; i++) radii[i] = Math.max(radii[i], radii[i - perTurn] + PITCH);
    for (let i = SPRING_SAMPLES - perTurn; i >= 0; i--) radii[i] = Math.min(radii[i], radii[i + perTurn] - PITCH);
    for (let i = 0; i <= SPRING_SAMPLES; i++) radii[i] = Math.min(OUTER, Math.max(INNER, radii[i]));

    ribbon.update(
      u => radii[Math.round(u * SPRING_SAMPLES)],
      u => inner - u * turns * TAU + u * drum,
    );
  });

  return <mesh geometry={ribbon.geometry} material={m.mainspring} position={[0, 0, BARREL_SPEC.bottomZ + 0.02]} castShadow />;
}

export function Ratchet({ story }: Props) {
  const m = getMaterials();
  const rotor = useRef<THREE.Group>(null!);
  const wheel = useMemo(
    () =>
      planarUV(
        createWheel({
          teeth: WINDING.ratchetTeeth,
          pitchRadius: WINDING.ratchetRadius,
          thickness: 0.05,
          spokes: 5,
          hubRadius: 0.17,
          toothWidth: 0.5,
          holeRadius: 0.05,
        }),
        WINDING.ratchetRadius,
      ),
    [],
  );
  useFrame(() => {
    rotor.current.rotation.z = story.mech.winding.ratchet;
  });
  return (
    <group ref={rotor}>
      <mesh geometry={wheel} material={[m.grained, m.steel]} position={[0, 0, WINDING.topZ]} castShadow />
      <Screw position={[0, 0, WINDING.topZ + 0.025]} radius={0.12} />
    </group>
  );
}

export function CrownWheel({ story }: Props) {
  const m = getMaterials();
  const rotor = useRef<THREE.Group>(null!);
  const wheel = useMemo(
    () =>
      planarUV(
        createWheel({
          teeth: WINDING.crownWheelTeeth,
          pitchRadius: WINDING.crownWheelRadius,
          thickness: 0.05,
          spokes: 0,
          holeRadius: 0.04,
        }),
        WINDING.crownWheelRadius,
      ),
    [],
  );
  useFrame(() => {
    rotor.current.rotation.z = story.mech.winding.crownWheel;
  });
  return (
    <group ref={rotor}>
      <mesh geometry={wheel} material={[m.grained, m.steel]} position={[0, 0, WINDING.topZ]} castShadow />
      <Screw position={[0, 0, WINDING.topZ + 0.025]} radius={0.08} />
    </group>
  );
}

/** The click pawl rides over each ratchet tooth and drops back. */
export function Click({ story }: Props) {
  const m = getMaterials();
  const pawl = useRef<THREE.Group>(null!);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.03);
    s.quadraticCurveTo(0.14, -0.05, 0.26, 0);
    s.lineTo(0.24, 0.03);
    s.quadraticCurveTo(0.12, 0.03, 0, 0.03);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 });
    g.translate(0, 0, -0.02);
    return g;
  }, []);
  useFrame(() => {
    pawl.current.rotation.z = -0.08 * story.mech.winding.click;
  });
  return (
    <group ref={pawl}>
      <mesh geometry={shape} material={m.steel} position={[0, 0, WINDING.topZ]} />
      <Screw position={[0, 0, WINDING.topZ + 0.02]} radius={0.04} />
    </group>
  );
}

const STEM_LENGTH = WINDING.crownX - WINDING.stemInnerX - 0.1;

export function Stem({ story }: Props) {
  const m = getMaterials();
  const rotor = useRef<THREE.Group>(null!);
  const pinion = useMemo(() => {
    const g = createPinion(WINDING.windingPinionTeeth, WINDING.windingPinionRadius, 0.08);
    g.rotateY(Math.PI / 2);
    return g;
  }, []);
  useFrame(() => {
    rotor.current.rotation.x = story.mech.winding.crown;
  });
  return (
    <group ref={rotor}>
      <mesh geometry={cylinder(0.034, STEM_LENGTH, 16)} material={m.steel} position={[STEM_LENGTH / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={pinion} material={m.steel} position={[WINDING.crownWheel[0] - WINDING.stemInnerX, 0, 0]} />
    </group>
  );
}

export function Crown({ story }: Props) {
  const m = getMaterials();
  const rotor = useRef<THREE.Group>(null!);
  const knurl = useMemo(() => {
    const g = createKnurledCylinder(0.27, 0.3, 36);
    g.rotateY(Math.PI / 2);
    return g;
  }, []);
  const cap = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.2, 0.22, 0.03, 48);
    g.rotateZ(-Math.PI / 2);
    return g;
  }, []);
  useFrame(() => {
    rotor.current.rotation.x = story.mech.winding.crown;
  });
  return (
    <group>
      <mesh geometry={cylinder(0.09, 0.2, 20)} material={m.caseSteel} position={[-0.12, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <group ref={rotor}>
        <mesh geometry={knurl} material={m.caseSteel} position={[0.13, 0, 0]} castShadow />
        <mesh geometry={cap} material={m.caseBrushed} position={[0.29, 0, 0]} />
        <mesh geometry={cylinder(0.06, 0.02, 24)} material={m.gold} position={[0.305, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      </group>
    </group>
  );
}
