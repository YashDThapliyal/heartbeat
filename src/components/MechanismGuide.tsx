/**
 * Visual guides layered on the mechanism:
 *  - EnergyFlow: a glowing trail tracing power from the barrel through each
 *    wheel-to-pinion contact to the escape wheel, led by a bright spark.
 *  - DisplayLinks: arbors extended up to the hands they carry.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import { ARBORS, LEVELS, WATCH } from '../movement/config';
import { EXTERIOR } from '../animation/exterior';

const LIFT = 0.07;

interface Stage {
  points: THREE.Vector3[];
}

/** Arbor centre → contact point with the next pinion → next arbor centre. */
function buildStages(): Stage[] {
  const stages: Stage[] = [];
  for (let i = 0; i < ARBORS.length - 1; i++) {
    const a = ARBORS[i];
    const b = ARBORS[i + 1];
    const dx = b.position[0] - a.position[0];
    const dy = b.position[1] - a.position[1];
    const d = Math.hypot(dx, dy);
    const contact = new THREE.Vector3(
      a.position[0] + (dx / d) * a.wheel.pitchRadius,
      a.position[1] + (dy / d) * a.wheel.pitchRadius,
      a.wheel.z + LIFT,
    );
    stages.push({
      points: [
        new THREE.Vector3(a.position[0], a.position[1], a.wheel.z + LIFT),
        contact,
        new THREE.Vector3(b.position[0], b.position[1], b.pinion!.z + LIFT),
        new THREE.Vector3(b.position[0], b.position[1], b.wheel.z + LIFT),
      ],
    });
  }
  return stages;
}

/** Energy is drawn above the metal and pushed past white so the bloom catches it. */
const HOT = new THREE.Color(1.7, 0.95, 0.32);
const TUBE_RADIUS = 0.02;
const TUBE_SEGMENTS = 480;
const TUBE_SIDES = 8;

function energyPath(): { curve: THREE.CurvePath<THREE.Vector3>; stageEnds: number[] } {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  const stageEnds: number[] = [0];
  let length = 0;
  buildStages().forEach(stage => {
    for (let i = 1; i < stage.points.length; i++) {
      const line = new THREE.LineCurve3(stage.points[i - 1], stage.points[i]);
      curve.add(line);
      length += line.getLength();
    }
    stageEnds.push(length);
  });
  return { curve, stageEnds: stageEnds.map(l => l / length) };
}

export function EnergyFlow({ story }: { story: Story }) {
  const group = useRef<THREE.Group>(null!);
  const spark = useRef<THREE.Mesh>(null!);
  const halo = useRef<THREE.Sprite>(null!);
  const { curve, stageEnds } = useMemo(energyPath, []);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, TUBE_SIDES, false), [curve]);
  const materials = useMemo(
    () => ({
      route: new THREE.MeshBasicMaterial({ color: '#c9a36a', transparent: true, opacity: 0, depthTest: false, toneMapped: false }),
      flow: new THREE.MeshBasicMaterial({
        color: HOT,
        transparent: true,
        opacity: 0,
        depthTest: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    }),
    [],
  );
  const haloTexture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,230,180,1)');
    g.addColorStop(0.2, 'rgba(255,180,90,0.7)');
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
  const flowMesh = useRef<THREE.Mesh>(null!);
  const head = useMemo(() => new THREE.Vector3(), []);
  const indexPerSegment = TUBE_SIDES * 6;

  useFrame(() => {
    const f = story.frame;
    const w = story.explore ? 0 : f.focus.train;
    group.current.visible = w > 0.01;
    if (!group.current.visible) return;
    materials.route.opacity = 0.28 * w;
    materials.flow.opacity = w;

    // Energy position (0 = barrel … 4 = escape) → fraction of the path, stage by stage.
    const e = Math.max(0, Math.min(stageEnds.length - 1, f.energy + 0.35));
    const stage = Math.min(stageEnds.length - 2, Math.floor(e));
    const u = stageEnds[stage] + (stageEnds[stage + 1] - stageEnds[stage]) * Math.min(1, e - stage);
    flowMesh.current.geometry.setDrawRange(0, Math.floor(u * TUBE_SEGMENTS) * indexPerSegment);
    curve.getPointAt(Math.min(1, u), head);

    spark.current.position.copy(head);
    halo.current.position.copy(head);
    const pulse = 0.85 + Math.sin(story.elapsed * 6) * 0.15;
    halo.current.scale.setScalar(0.7 * pulse * w);
    spark.current.scale.setScalar(w);
  });

  return (
    <group ref={group}>
      <mesh geometry={tube} material={materials.route} renderOrder={20} raycast={() => undefined} />
      <mesh ref={flowMesh} geometry={tube.clone()} material={materials.flow} renderOrder={21} raycast={() => undefined} />
      <mesh ref={spark} renderOrder={22} raycast={() => undefined}>
        <sphereGeometry args={[0.03, 16, 12]} />
        <meshBasicMaterial color={HOT} depthTest={false} toneMapped={false} />
      </mesh>
      <sprite ref={halo} renderOrder={22} raycast={() => undefined}>
        <spriteMaterial map={haloTexture} depthTest={false} transparent blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}

/** Thin vertical links from the centre and fourth arbors to the hands they carry. */
export function DisplayLinks({ story }: { story: Story }) {
  const group = useRef<THREE.Group>(null!);
  const material = useMemo(
    () => new THREE.LineDashedMaterial({ color: '#ffcf8f', dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0 }),
    [],
  );
  const lines = useMemo(() => {
    const centre = ARBORS.find(a => a.id === 'center')!.position;
    return [centre, WATCH.subSeconds].map(p => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p[0], p[1], LEVELS.trainBridge[1] + 0.1),
        new THREE.Vector3(p[0], p[1], LEVELS.dial + 0.1),
      ]);
      const line = new THREE.Line(g, material);
      line.computeLineDistances();
      line.raycast = () => undefined;
      return line;
    });
  }, [material]);

  useFrame(() => {
    const w = story.explore ? 0 : story.frame.focus.display;
    group.current.visible = w > 0.01;
    material.opacity = 0.8 * w;
    // Stretch to the hands as they hover above the movement.
    const handsZ = LEVELS.dial + 0.1 + EXTERIOR.hands.stacked[2] * story.frame.stack.hands;
    const s = (handsZ - (LEVELS.trainBridge[1] + 0.1)) / (LEVELS.dial - LEVELS.trainBridge[1]);
    for (const line of lines) {
      line.scale.z = s;
      line.position.z = (LEVELS.trainBridge[1] + 0.1) * (1 - s);
    }
  });

  return (
    <group ref={group}>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  );
}
