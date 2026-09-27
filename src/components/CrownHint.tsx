/**
 * "Wind here": while the viewer can wind, a glowing arrow circles the crown in
 * the winding direction, and a soft halo marks the crown itself. Both fade away
 * once the mainspring is fully wound.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import { WOUND } from '../animation/interaction';

const HOT = new THREE.Color(1.8, 1.0, 0.35);
const RADIUS = 0.46;
const ARC = Math.PI * 1.45;
/** Centre of the knurled grip, along the stem (the crown group's local X). */
const GRIP_X = 0.13;

function haloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,205,140,0.9)');
  g.addColorStop(0.35, 'rgba(255,165,80,0.35)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function CrownHint({ story }: { story: Story }) {
  const root = useRef<THREE.Group>(null!);
  const spinner = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Sprite>(null!);
  const weight = useRef(0);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: HOT,
        transparent: true,
        opacity: 0,
        depthTest: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const arc = useMemo(() => new THREE.TorusGeometry(RADIUS, 0.018, 8, 64, ARC), []);
  const head = useMemo(() => {
    // Cones point along +Y; rotated by ARC below, that is the arc's direction of travel.
    return new THREE.ConeGeometry(0.06, 0.16, 16);
  }, []);
  const texture = useMemo(haloTexture, []);

  useFrame((_, delta) => {
    const want = !story.explore && story.frame.handsOn === 'wind' && story.interact.wind < WOUND ? 1 : 0;
    weight.current = THREE.MathUtils.damp(weight.current, want, 5, Math.min(delta, 0.05));
    const w = weight.current;
    root.current.visible = w > 0.01;
    if (!root.current.visible) return;
    const pulse = 0.75 + 0.25 * Math.sin(story.elapsed * 4);
    material.opacity = w * pulse;
    // Circles the way the crown winds; quicker while the viewer is actually winding.
    spinner.current.rotation.x += Math.min(delta, 0.05) * (story.interact.windHeld ? 3.2 : 1.4);
    halo.current.scale.setScalar(1.3 * w * (0.9 + 0.1 * pulse));
    (halo.current.material as THREE.SpriteMaterial).opacity = w * 0.8;
  });

  return (
    <group ref={root} position={[GRIP_X, 0, 0]}>
      <sprite ref={halo} renderOrder={23} raycast={() => undefined}>
        <spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* Torus lies in its XY plane; turn it to circle the stem (the X axis). */}
      <group ref={spinner}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <mesh geometry={arc} material={material} renderOrder={24} raycast={() => undefined} />
          <mesh
            geometry={head}
            material={material}
            position={[Math.cos(ARC) * RADIUS, Math.sin(ARC) * RADIUS, 0]}
            rotation={[0, 0, ARC]}
            renderOrder={24}
            raycast={() => undefined}
          />
        </group>
      </group>
    </group>
  );
}
