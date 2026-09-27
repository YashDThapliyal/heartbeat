/**
 * One persistent WebGL scene for the whole experience.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bvh, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Story } from '../animation/story';
import { sampleFrame, type Shot } from '../animation/timeline';
import { advanceMechanics } from '../animation/mechanics';
import type { PartId } from '../movement/catalog';
import { Watch } from './Watch';
import { LabelProjector } from './ProjectedLabel';
import { Backdrop, Effects, GlidingReflections, Studio } from './Stage';
import { HandsOnInput } from './HandsOnInput';
import { FlyTo } from './FlyTo';

interface SceneProps {
  story: Story;
  exploring: boolean;
  resetKey: number;
  labelsRoot: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: PartId | null) => void;
  onReady: () => void;
  onQualityChange: (q: Story['quality']) => void;
  onGesture: () => void;
  onOpen: () => void;
}

const EXPLORE_CAMERA = new THREE.Vector3(6.2, -8.6, 7.6);
const EXPLORE_TARGET = new THREE.Vector3(0, 0, 0.9);

/** Fits a desktop-composed shot to the current viewport. */
function applyShot(camera: THREE.PerspectiveCamera, shot: Shot, width: number, height: number, tmp: THREE.Vector3): void {
  // Narrow screens see less horizontally at the same FOV: pull back to fit.
  const dolly = Math.max(1, 0.95 / (width / height));
  tmp.set(shot.camera[0] - shot.target[0], shot.camera[1] - shot.target[1], shot.camera[2] - shot.target[2]).multiplyScalar(dolly);
  camera.position.set(shot.target[0] + tmp.x, shot.target[1] + tmp.y, shot.target[2] + tmp.z);
  camera.up.set(shot.up[0], shot.up[1], shot.up[2]).normalize();
  camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
  camera.fov = shot.fov;
  composeFrame(camera, width, height, shot.frameX);
}

/**
 * Shift the frame (not the perspective) so the subject sits beside the copy on
 * wide screens, and below it on portrait screens.
 */
function composeFrame(camera: THREE.PerspectiveCamera, width: number, height: number, frameX: number): void {
  const aspect = width / height;
  const portrait = aspect < 0.9;
  const x = portrait ? 0 : frameX * Math.min(1, (aspect - 0.9) / 0.5);
  const y = portrait ? 0.15 : 0;
  camera.setViewOffset(width, height, -x * width, -y * height, width, height);
  camera.updateProjectionMatrix();
}

function Director({ story, exploring, resetKey }: { story: Story; exploring: boolean; resetKey: number }) {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const size = useThree(s => s.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const [orbit, setOrbit] = useState(false);

  useLayoutEffect(() => {
    if (!exploring) {
      setOrbit(false);
      return;
    }
    // OrbitControls reads camera.up when it is created, so set it first.
    camera.up.set(0, 0, 1);
    const dolly = Math.max(1, 0.95 / (size.width / size.height));
    camera.position.copy(EXPLORE_CAMERA).sub(EXPLORE_TARGET).multiplyScalar(dolly).add(EXPLORE_TARGET);
    camera.fov = 30;
    camera.lookAt(EXPLORE_TARGET);
    camera.updateProjectionMatrix();
    setOrbit(true);
    // Viewport size is read once: re-frame on entering Explore or Reset, not on resize.
  }, [exploring, resetKey, camera]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    story.elapsed += dt;
    const k = story.reduced ? 14 : 4.5;
    story.p = THREE.MathUtils.damp(story.p, story.targetP, k, dt);
    if (Math.abs(story.p - story.targetP) < 1e-4) story.p = story.targetP;
    if (!story.explore) {
      sampleFrame(story.p, story.frame);
      // Scrolling out of a hoverable span must not leave a part (or the cursor) stuck.
      if (!story.frame.hoverable && story.hovered) {
        story.hovered = null;
        document.body.style.cursor = '';
      }
    }
    advanceMechanics(story, dt);
    story.portrait = size.width / size.height < 0.9;
    if (!story.explore) applyShot(camera, story.frame.shot, size.width, size.height, tmp);
    else composeFrame(camera, size.width, size.height, 0.13);
  }, -10);

  const homeDistance = EXPLORE_CAMERA.distanceTo(EXPLORE_TARGET) * Math.max(1, 0.95 / (size.width / size.height));
  return orbit ? (
    <>
    <FlyTo story={story} home={EXPLORE_TARGET} homeDistance={homeDistance} />
    <OrbitControls
      key={resetKey}
      ref={controls}
      makeDefault
      target={EXPLORE_TARGET}
      enableDamping
      dampingFactor={0.08}
      minDistance={2.2}
      maxDistance={24}
      enablePan={false}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
    />
    </>
  ) : null;
}

/** With post-processing, tone mapping happens in the composer; without it, in the renderer. */
function ToneMappingSwitch({ quality }: { quality: Story['quality'] }) {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    gl.toneMapping = quality === 'high' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1;
  }, [gl, quality]);
  return null;
}

/** Development only: exposes the store and camera to automated visual checks. */
function DebugBridge({ story }: { story: Story }) {
  const camera = useThree(s => s.camera);
  const scene = useThree(s => s.scene);
  const controls = useThree(s => s.controls);
  const get = useThree(s => s.get);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __calibre?: unknown }).__calibre = { story, camera, scene, controls, r3f: get };
  }, [story, camera, scene, controls, get]);
  return null;
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onReady();
  });
  return null;
}

export function Scene({ story, exploring, resetKey, labelsRoot, onSelect, onReady, onQualityChange, onGesture, onOpen }: SceneProps) {
  const [quality, setQuality] = useState<Story['quality']>(story.quality);
  useEffect(() => {
    story.quality = quality;
    onQualityChange(quality);
  }, [quality, story, onQualityChange]);

  return (
    <Canvas
      className="scene-canvas"
      shadows={quality === 'high' ? 'soft' : false}
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.25]}
      camera={{ position: [3.2, -3.4, 15.2], fov: 30, near: 0.1, far: 120 }}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', alpha: false, stencil: false }}
      onPointerMissed={() => {
        if (story.explore) onSelect(null);
      }}
    >
      <color attach="background" args={['#090a0b']} />
      <PerformanceMonitor onDecline={() => setQuality('low')} flipflops={1} />
      <Suspense fallback={null}>
        <Director story={story} exploring={exploring} resetKey={resetKey} />
        <Studio quality={quality} />
        <GlidingReflections story={story} />
        <Backdrop />
        <Bvh firstHitOnly>
          <Watch story={story} onSelect={onSelect} onOpen={onOpen} />
        </Bvh>
        <LabelProjector story={story} root={labelsRoot} onSelect={onSelect} />
        <Effects story={story} quality={quality} />
        <ToneMappingSwitch quality={quality} />
        <ReadySignal onReady={onReady} />
        <HandsOnInput story={story} onGesture={onGesture} />
        <DebugBridge story={story} />
      </Suspense>
    </Canvas>
  );
}
