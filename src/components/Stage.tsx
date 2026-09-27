/**
 * The photographic stage: studio lighting built from light panels and strip
 * lights, reflections that glide as the story moves, a soft backdrop glow, and
 * restrained post-processing (AO, glints, depth of field in close-ups).
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import * as THREE from 'three';
import type { Story } from '../animation/story';

interface StageProps {
  story: Story;
  quality: Story['quality'];
}

/**
 * Softboxes give broad, even reflections; thin strips draw the crisp highlight
 * lines that make polished edges read as polished.
 */
export function Studio({ quality }: { quality: Story['quality'] }) {
  return (
    <>
      <Environment resolution={512} frames={1}>
        {/* Key softbox, high and to the left */}
        <Lightformer form="rect" intensity={1.6} color="#fff5e8" scale={[10, 6, 1]} position={[-4, 6, 8]} />
        {/* Crisp vertical strips either side */}
        <Lightformer form="rect" intensity={6} color="#fff1dc" scale={[0.35, 14, 1]} position={[7, 0.5, 5]} />
        <Lightformer form="rect" intensity={3.5} color="#dfe9f5" scale={[0.25, 14, 1]} position={[-7.5, -1, 4]} />
        {/* Low horizontal strip for a line along the lower edges */}
        <Lightformer form="rect" intensity={3} color="#ffffff" scale={[16, 0.3, 1]} position={[0, -7, 5]} />
        {/* Overhead fill and a warm ring for round highlights on screws and jewels */}
        <Lightformer form="rect" intensity={0.55} color="#f4f1ea" scale={[4, 4, 1]} position={[4, 3, 12]} />
        <Lightformer form="ring" intensity={1.1} color="#ffe6c4" scale={2.5} position={[3, 4, 9]} />
        {/* Rim light from behind separates parts from the dark */}
        <Lightformer form="rect" intensity={1.4} color="#c9d6e6" scale={[18, 3, 1]} position={[0, 8, -5]} />
        <Lightformer form="rect" intensity={0.4} color="#b8c4d0" scale={[20, 6, 1]} position={[0, 0, -9]} />
      </Environment>
      <ambientLight intensity={0.06} />
      <directionalLight
        position={[3.5, 5, 9]}
        intensity={1.35}
        color="#fff3e0"
        castShadow={quality === 'high'}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.015}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      <directionalLight position={[-6, -2, 4]} intensity={0.4} color="#cfe0ff" />
    </>
  );
}

/** Reflections slide slowly across the metal as the story moves, and drift at rest. */
export function GlidingReflections({ story }: { story: Story }) {
  const scene = useThree(s => s.scene);
  useFrame(() => {
    const drift = story.reduced ? 0 : Math.sin(story.elapsed * 0.13) * 0.1;
    scene.environmentRotation.set(0, drift + story.p * 0.03, Math.sin(story.p * 0.7) * 0.18);
  });
  return null;
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  // Opaque, fading to the page background, so it can be drawn first.
  g.addColorStop(0, '#2a2622');
  g.addColorStop(0.5, '#151412');
  g.addColorStop(1, '#090a0b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BACKDROP_DISTANCE = 70;
/** A whisper of colour fringing toward the frame edges, as from real glass. */
const LENS_FRINGE = new THREE.Vector2(0.0007, 0.0005);

/**
 * A soft pool of light behind the subject, like a product photograph. It rides
 * with the camera, so it always sits behind whatever is in frame.
 */
export function Backdrop() {
  const mesh = useRef<THREE.Mesh>(null!);
  const texture = useMemo(glowTexture, []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera;
    camera.getWorldDirection(forward);
    mesh.current.position.copy(camera.position).addScaledVector(forward, BACKDROP_DISTANCE);
    mesh.current.quaternion.copy(camera.quaternion);
    const height = 2 * BACKDROP_DISTANCE * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    // Cover the whole view; the glow sits in the middle of the plane.
    const s = height * 1.25;
    mesh.current.scale.set(s * Math.max(1, size.width / size.height), s, 1);
  });
  return (
    <mesh ref={mesh} renderOrder={-10} frustumCulled={false} raycast={() => undefined}>
      <planeGeometry />
      <meshBasicMaterial map={texture} depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

/** Depth of field follows the story: the subject of each close-up stays sharp. */
function FocusPuller({ story, effect }: { story: Story; effect: React.RefObject<DepthOfFieldEffect | null> }) {
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const dof = effect.current;
    if (!dof) return;
    // A shallow baseline everywhere (as a real lens would have), deeper in close-ups.
    const strength = story.explore || story.reduced ? 0 : Math.max(0.2, story.frame.dof);
    const t = story.frame.shot.target;
    target.set(t[0], t[1], t[2]);
    dof.target = target;
    const distance = camera.position.distanceTo(target);
    dof.cocMaterial.focusRange = distance * 0.42;
    dof.bokehScale = strength * 2.6;
  });
  return null;
}

export function Effects({ story, quality }: StageProps) {
  const dof = useRef<DepthOfFieldEffect>(null);
  if (quality === 'low') return null;
  return (
    <>
      <FocusPuller story={story} effect={dof} />
      <EffectComposer multisampling={4} enableNormalPass={false}>
        <N8AO aoRadius={0.28} distanceFalloff={0.6} intensity={1.6} quality="medium" halfRes />
        <DepthOfField ref={dof} focusDistance={8} focusRange={3} bokehScale={0} resolutionScale={0.5} />
        <Bloom mipmapBlur luminanceThreshold={0.88} luminanceSmoothing={0.12} intensity={0.55} radius={0.62} />
        <ChromaticAberration offset={LENS_FRINGE} radialModulation modulationOffset={0.45} />
        <Vignette offset={0.24} darkness={0.66} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.35} />
      </EffectComposer>
    </>
  );
}
