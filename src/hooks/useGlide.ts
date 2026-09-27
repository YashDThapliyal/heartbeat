import { useCallback, useEffect, useRef } from 'react';
import type { Story } from '../animation/story';

/**
 * Plays the story from where it is to a target at a steady, deliberate pace
 * (story units per second). Scrolling or navigating cancels it.
 */
export function useGlide(story: Story, seek: (p: number) => void): (to: number, speed: number) => void {
  const frame = useRef(0);

  const cancel = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) cancel();
    };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchmove', cancel, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      cancel();
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchmove', cancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [cancel]);

  return useCallback(
    (to: number, speed: number) => {
      cancel();
      const from = story.targetP;
      const duration = Math.abs(to - from) / speed;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 1000 / duration);
        // Gentle ease at both ends; the pieces carry their own easing in between.
        const eased = t < 0.1 ? (t * t) / 0.2 : t > 0.9 ? 1 - ((1 - t) * (1 - t)) / 0.2 : t;
        seek(from + (to - from) * eased);
        frame.current = t < 1 ? requestAnimationFrame(step) : 0;
      };
      frame.current = requestAnimationFrame(step);
    },
    [story, seek, cancel],
  );
}
