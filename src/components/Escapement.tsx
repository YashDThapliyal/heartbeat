/**
 * The Swiss lever escapement and oscillator: pallet fork, balance and hairspring.
 * Geometry is built from the same constants the simulation uses, so the stones
 * really do dip into the tooth circle and the impulse pin really sits in the notch.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import { BALANCE, ESCAPEMENT, LEVELS } from '../movement/config';
import { getMaterials } from '../movement/materials';
import { TAU } from '../movement/simulation';
import { box as boxSdf, capsule, circle, subtract, union } from '../geometry/outline';
import { createSlab } from '../geometry/outline';
import { turned } from '../geometry/parts';
import { SpiralRibbon } from '../geometry/spiral';
import { registerCallout } from './labelRegistry';
import { Jewel, Staff, cylinder } from './Mechanics';

const {
  palletDistance: DP,
  tipRadius: RE,
  lockDepth,
  stoneArm,
  forkBanking,
  forkLength: LF,
  rollerRadius: RR,
  stoneHalfSpan,
  stoneWidth,
  z: Z,
} = ESCAPEMENT;

/** Stone tip distance from the escape centre with the fork at mid-travel. */
const TIP_AT_REST = RE - lockDepth + stoneArm * forkBanking;
const STONE_LENGTH = 0.15;
const FORK_THICKNESS = 0.036;

/** Stone position/orientation in the fork frame (pivot at origin, +X toward the balance). */
function stonePlacement(side: -1 | 1): { position: [number, number]; angle: number } {
  const a = side * stoneHalfSpan;
  return { position: [-DP + Math.cos(a) * TIP_AT_REST, Math.sin(a) * TIP_AT_REST], angle: a };
}

function stoneGeometry(): THREE.ExtrudeGeometry {
  // Tip at the origin, body running outward along +X; the locking corner is at −Y.
  const half = stoneWidth / 2;
  const s = new THREE.Shape();
  s.moveTo(0, -half);
  s.lineTo(STONE_LENGTH, -half);
  s.lineTo(STONE_LENGTH, half);
  s.lineTo(0.032, half);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.046, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 });
  g.translate(0, 0, -0.023);
  return g;
}

function forkGeometry(): THREE.BufferGeometry {
  const entry = stonePlacement(-1);
  const exit = stonePlacement(1);
  const seat = (p: { position: [number, number]; angle: number }): [number, number] => [
    p.position[0] + Math.cos(p.angle) * (STONE_LENGTH * 0.8),
    p.position[1] + Math.sin(p.angle) * (STONE_LENGTH * 0.8),
  ];
  const sdf = subtract(
    union(
      0.05,
      circle([0, 0], 0.07),
      capsule([0, 0], seat(entry), 0.045, 0.04),
      capsule([0, 0], seat(exit), 0.045, 0.04),
      capsule([0, 0], [LF - 0.08, 0], 0.03, 0.022),
      capsule([LF - 0.1, 0.02], [LF + 0.07, 0.05], 0.022, 0.018),
      capsule([LF - 0.1, -0.02], [LF + 0.07, -0.05], 0.022, 0.018),
    ),
    boxSdf([LF + 0.06, 0], 0.08, 0.026, 0, 0.01),
  );
  const g = createSlab(sdf, {
    thickness: FORK_THICKNESS,
    bevel: 0.005,
    cell: 0.004,
    bounds: { minX: -0.2, minY: -0.34, maxX: LF + 0.2, maxY: 0.34 },
  });
  g.translate(0, 0, -FORK_THICKNESS / 2);
  return g;
}

interface Props {
  story: Story;
}

export function PalletFork({ story }: Props) {
  const m = getMaterials();
  const rotor = useRef<THREE.Group>(null!);
  const entryAnchor = useRef<THREE.Group>(null!);
  const exitAnchor = useRef<THREE.Group>(null!);
  const fork = useMemo(forkGeometry, []);
  const stone = useMemo(stoneGeometry, []);
  const entry = stonePlacement(-1);
  const exit = stonePlacement(1);
  // Banking pins: where the lever comes to rest either side.
  const bankX = 0.3;
  const bankY = bankX * Math.sin(forkBanking) + 0.034;

  useEffect(() => {
    const offEntry = registerCallout('entry', entryAnchor.current);
    const offExit = registerCallout('exit', exitAnchor.current);
    return () => {
      offEntry();
      offExit();
    };
  }, []);

  useFrame(() => {
    rotor.current.rotation.z = ESCAPEMENT.lineOfCentres + story.mech.escapement.fork;
  });

  return (
    <group>
      <Staff from={0} to={LEVELS.palletCock[0]} />
      <group rotation={[0, 0, ESCAPEMENT.lineOfCentres]}>
        {[-1, 1].map(s => (
          <mesh key={s} geometry={cylinder(0.016, 0.1, 12)} material={m.steel} position={[bankX, s * bankY, Z - 0.02]} />
        ))}
      </group>
      <group ref={rotor}>
        <mesh geometry={fork} material={m.escapeSteel} position={[0, 0, Z]} castShadow />
        <mesh geometry={cylinder(0.055, 0.05, 24)} material={m.giltPolished} position={[0, 0, Z]} />
        {[entry, exit].map((p, i) => (
          <mesh
            key={i}
            geometry={stone}
            material={m.ruby}
            position={[p.position[0], p.position[1], Z]}
            rotation={[0, 0, p.angle]}
          />
        ))}
        <group ref={entryAnchor} position={[entry.position[0], entry.position[1], Z + 0.03]} />
        <group ref={exitAnchor} position={[exit.position[0], exit.position[1], Z + 0.03]} />
        {/* Guard pin */}
        <mesh geometry={cylinder(0.01, 0.06, 8)} material={m.steel} position={[LF - 0.03, 0, Z - 0.03]} />
      </group>
    </group>
  );
}

const RIM_SCREWS = 10;

function rimGeometry(): THREE.BufferGeometry {
  const r = BALANCE.rimRadius;
  const w = BALANCE.rimWidth;
  const h = 0.06;
  return turned(
    [
      [r - w, -h / 2],
      [r, -h / 2],
      [r + 0.004, 0],
      [r, h / 2],
      [r - w, h / 2],
      [r - w - 0.004, 0],
      [r - w, -h / 2],
    ],
    96,
  );
}

export function BalanceWheel({ story }: Props) {
  const m = getMaterials();
  const rotor = useRef<THREE.Group>(null!);
  const pin = useRef<THREE.Group>(null!);
  const rim = useMemo(rimGeometry, []);
  const roller = useMemo(
    () =>
      turned(
        [
          [0.02, -0.012],
          [0.25, -0.012],
          [0.26, 0],
          [0.25, 0.012],
          [0.02, 0.012],
        ],
        48,
      ),
    [],
  );
  const arm = useMemo(() => new THREE.BoxGeometry(BALANCE.rimRadius - 0.06, 0.05, 0.034), []);

  useEffect(() => registerCallout('pin', pin.current), []);

  useFrame(() => {
    // At rest, the impulse pin (local +X) points at the pallet fork.
    rotor.current.rotation.z = ESCAPEMENT.lineOfCentres + Math.PI + story.mech.escapement.balance;
  });

  const zRim = BALANCE.rimZ;
  return (
    <group>
      <Staff from={-0.08} to={LEVELS.balanceCock[0]} radius={0.016} />
      <group ref={rotor}>
        <mesh geometry={rim} material={m.balance} position={[0, 0, zRim]} castShadow />
        {[0, 1, 2].map(i => (
          <mesh
            key={i}
            geometry={arm}
            material={m.balance}
            position={[Math.cos((i * TAU) / 3 + 0.5) * (BALANCE.rimRadius / 2), Math.sin((i * TAU) / 3 + 0.5) * (BALANCE.rimRadius / 2), zRim]}
            rotation={[0, 0, (i * TAU) / 3 + 0.5]}
            castShadow
          />
        ))}
        {Array.from({ length: RIM_SCREWS }, (_, i) => {
          const a = (i / RIM_SCREWS) * TAU + 0.17;
          const r = BALANCE.rimRadius + 0.02;
          return (
            <mesh
              key={i}
              geometry={cylinder(0.024, 0.045, 12)}
              material={m.giltPolished}
              position={[Math.cos(a) * r, Math.sin(a) * r, zRim]}
              rotation={[0, Math.PI / 2, a]}
            />
          );
        })}
        <mesh geometry={cylinder(0.075, 0.07, 24)} material={m.balance} position={[0, 0, zRim]} />
        <mesh geometry={roller} material={m.escapeSteel} position={[0, 0, BALANCE.rollerZ + 0.03]} />
        <mesh geometry={cylinder(0.12, 0.018, 32)} material={m.escapeSteel} position={[0, 0, BALANCE.rollerZ + 0.07]} />
        {/* Impulse jewel (ruby pin) reaching down into the fork notch */}
        <mesh geometry={cylinder(0.018, 0.08, 12)} material={m.ruby} position={[RR, 0, Z + 0.01]} />
        <group ref={pin} position={[RR, 0, Z + 0.04]} />
      </group>
      <Jewel position={[0, 0, -0.07]} radius={0.06} />
    </group>
  );
}

export function Hairspring({ story }: Props) {
  const m = getMaterials();
  const ribbon = useMemo(() => new SpiralRibbon({ samples: 1100, width: 0.0048, height: 0.014 }), []);
  useEffect(() => () => ribbon.dispose(), [ribbon]);
  const { hairspringInner: r0, hairspringOuter: r1, hairspringTurns: turns } = BALANCE;
  /** The stud holds the outer end still; it sits toward the balance cock. */
  const stud = 2.25;
  const last = useRef(Number.NaN);

  useFrame(() => {
    const theta = story.mech.escapement.balance;
    if (theta === last.current) return;
    last.current = theta;
    const breath = theta / ESCAPEMENT.amplitude;
    ribbon.update(
      u => r0 + (r1 - r0) * u + Math.sin(Math.PI * u) * breath * 0.028 * (1 - u * 0.3),
      u => stud + theta * (1 - u) + (1 - u) * turns * TAU,
    );
  });

  const outerEnd: [number, number] = [Math.cos(stud) * r1, Math.sin(stud) * r1];
  return (
    <group>
      <mesh geometry={ribbon.geometry} material={m.hairspring} position={[0, 0, BALANCE.hairspringZ]} />
      <mesh geometry={cylinder(0.05, 0.05, 20)} material={m.steel} position={[0, 0, BALANCE.hairspringZ + 0.016]} />
      <mesh geometry={cylinder(0.022, 0.06, 12)} material={m.blued} position={[outerEnd[0], outerEnd[1], BALANCE.hairspringZ + 0.02]} />
    </group>
  );
}
