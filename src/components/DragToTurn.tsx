/**
 * On the opening screens the watch can be grabbed and turned. Dragging sets
 * the spin directly; letting go leaves it coasting with a little inertia.
 * Once the story begins, the watch eases back into its choreographed pose.
 */
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import { CHAPTERS, INTRO } from '../animation/chapters';
import { smoothstep } from '../movement/simulation';

const SENSITIVITY = 0.008;
const MAX_TILT = 0.7;
const TAU = Math.PI * 2;

/** 1 while the watch may be turned freely, fading to 0 as the watch opens. */
export function freeTurnWeight(story: Story): number {
  if (story.explore) return 0;
  const start = INTRO + 0.35;
  const end = CHAPTERS[1].start + 0.1;
  return 1 - smoothstep((story.p - start) / (end - start));
}

export function DragToTurn({ story }: { story: Story }) {
  const canvas = useThree(s => s.gl.domElement);

  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    const spin = story.spin;
    const down = (e: PointerEvent) => {
      if (freeTurnWeight(story) < 0.5 || e.button !== 0) return;
      spin.dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!spin.dragging) {
        if (freeTurnWeight(story) > 0.5 && !story.explore) canvas.style.cursor = spin.overWatch ? 'pointer' : 'grab';
        else if (canvas.style.cursor === 'grab' || canvas.style.cursor === 'pointer') canvas.style.cursor = '';
        return;
      }
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const dt = Math.max(1, e.timeStamp - lastT) / 1000;
      spin.y += dx * SENSITIVITY;
      spin.x = THREE.MathUtils.clamp(spin.x + dy * SENSITIVITY, -MAX_TILT, MAX_TILT);
      spin.vy = (dx * SENSITIVITY) / dt;
      spin.vx = (dy * SENSITIVITY) / dt;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
    };
    const up = (e: PointerEvent) => {
      if (!spin.dragging) return;
      spin.dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.style.cursor = '';
    };
  }, [canvas, story]);

  useFrame((_, delta) => {
    const spin = story.spin;
    if (spin.dragging) return;
    const dt = Math.min(delta, 0.05);
    // Coast, then settle.
    spin.y += spin.vy * dt;
    spin.x = THREE.MathUtils.clamp(spin.x + spin.vx * dt, -MAX_TILT, MAX_TILT);
    const friction = Math.exp(-3.2 * dt);
    spin.vy *= friction;
    spin.vx *= friction;
    // Tilt always relaxes a little; everything relaxes once the story moves on.
    const w = freeTurnWeight(story);
    spin.x = THREE.MathUtils.damp(spin.x, 0, w > 0.99 ? 0.6 : 4, dt);
    if (w < 0.99) {
      // Unwind to the nearest full turn, the short way round.
      const home = Math.round(spin.y / TAU) * TAU;
      spin.y = THREE.MathUtils.damp(spin.y, home, 4, dt);
      spin.vy *= friction;
    }
  });

  return null;
}
