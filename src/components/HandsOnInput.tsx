/**
 * Pointer input for the hands-on moments: drag across the watch to wind it,
 * tap the watch to let one beat through the escapement.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { Story } from '../animation/story';
import { WIND_PER_PIXEL, addWind, requestTick } from '../animation/interaction';

interface Props {
  story: Story;
  /** Called on any hands-on gesture (lets the page enable sound). */
  onGesture: () => void;
}

const TAP_SLOP = 8;

export function HandsOnInput({ story, onGesture }: Props) {
  const canvas = useThree(s => s.gl.domElement);

  useEffect(() => {
    let active: 'wind' | 'tick' | null = null;
    let lastX = 0;
    let lastY = 0;
    let travelled = 0;
    const touch = (e: PointerEvent) => e.pointerType === 'touch';

    const down = (e: PointerEvent) => {
      const mode = story.explore ? null : story.frame.handsOn;
      if (!mode || e.button !== 0) return;
      active = mode;
      lastX = e.clientX;
      lastY = e.clientY;
      travelled = 0;
      if (mode === 'wind') {
        canvas.setPointerCapture(e.pointerId);
        story.interact.windHeld = false;
      }
    };
    const move = (e: PointerEvent) => {
      const mode = story.explore ? null : story.frame.handsOn;
      if (!active) {
        const wanted = mode === 'wind' ? 'ew-resize' : mode === 'tick' ? 'pointer' : '';
        if (wanted) canvas.style.cursor = wanted;
        else if (canvas.style.cursor === 'ew-resize' || canvas.style.cursor === 'pointer') canvas.style.cursor = '';
        return;
      }
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      // On touch, vertical movement scrolls the page; only sideways strokes wind.
      const stroke = touch(e) ? Math.abs(dx) : Math.abs(dx) + Math.abs(dy);
      travelled += stroke;
      if (active === 'wind' && mode === 'wind') {
        addWind(story.interact, stroke * WIND_PER_PIXEL);
        if (travelled > TAP_SLOP) onGesture();
      }
    };
    const up = (e: PointerEvent) => {
      if (active === 'tick' && travelled < TAP_SLOP && story.frame.handsOn === 'tick') {
        requestTick(story.interact, story.time);
        onGesture();
      }
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      active = null;
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
    };
  }, [canvas, story, onGesture]);

  return null;
}
