/**
 * In Explore, selecting a part flies the orbit camera to it; clearing the
 * selection flies back to the whole movement. Grabbing the view cancels the flight.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Story } from '../animation/story';

interface Props {
  story: Story;
  home: THREE.Vector3;
  homeDistance: number;
}

const ARRIVE = 0.01;

export function FlyTo({ story, home, homeDistance }: Props) {
  const controls = useThree(s => s.controls) as OrbitControlsImpl | null;
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const flight = useRef<{ target: THREE.Vector3; distance: number } | null>(null);
  const last = useRef<string | null>(null);
  const box = useMemo(() => new THREE.Box3(), []);
  const sphere = useMemo(() => new THREE.Sphere(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      flight.current = null;
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useFrame((_, delta) => {
    if (!controls || !story.explore) {
      last.current = null;
      return;
    }
    if (story.selected !== last.current) {
      last.current = story.selected;
      const part = story.selected ? scene.getObjectByName(story.selected) : null;
      if (part) {
        box.setFromObject(part).getBoundingSphere(sphere);
        flight.current = { target: sphere.center.clone(), distance: THREE.MathUtils.clamp(sphere.radius * 4.2, 2.4, 9) };
      } else {
        flight.current = { target: home.clone(), distance: homeDistance };
      }
    }
    const f = flight.current;
    if (!f) return;
    const dt = Math.min(delta, 0.05);
    controls.target.x = THREE.MathUtils.damp(controls.target.x, f.target.x, 3.2, dt);
    controls.target.y = THREE.MathUtils.damp(controls.target.y, f.target.y, 3.2, dt);
    controls.target.z = THREE.MathUtils.damp(controls.target.z, f.target.z, 3.2, dt);
    offset.copy(camera.position).sub(controls.target);
    const distance = THREE.MathUtils.damp(offset.length(), f.distance, 3.2, dt);
    camera.position.copy(controls.target).add(offset.setLength(distance));
    controls.update();
    if (controls.target.distanceTo(f.target) < ARRIVE && Math.abs(distance - f.distance) < ARRIVE) flight.current = null;
  });

  return null;
}
