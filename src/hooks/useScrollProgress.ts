import { useCallback, useEffect } from 'react';
import type { Story } from '../animation/story';
import { INTRO, P_END } from '../animation/chapters';

function maxScroll(): number {
  return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

export interface ScrollControls {
  /** Smoothly scroll to a story position. */
  jump: (p: number) => void;
  /** Move to a story position immediately (the scene still eases toward it). */
  seek: (p: number) => void;
}

/**
 * Maps the page scroll position onto story progress. The scene damps toward
 * it, so the story scrubs smoothly in both directions and stops when you stop.
 */
export function useScrollProgress(story: Story): ScrollControls {
  useEffect(() => {
    const update = () => {
      if (story.explore) return;
      story.targetP = (window.scrollY / maxScroll()) * P_END;
    };
    // A small scroll away from the opening is enough: once it settles part-way
    // into the intro, glide the rest of the way to the landing.
    let settle = 0;
    const assist = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        const p = story.targetP;
        if (story.explore || p <= 0.01 || p >= INTRO - 0.01) return;
        window.scrollTo({ top: ((p > story.p - 0.001 ? INTRO : 0) / P_END) * maxScroll(), behavior: 'smooth' });
      }, 140);
    };
    const onScroll = () => {
      update();
      assist();
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, [story]);

  const jump = useCallback(
    (p: number) => {
      window.scrollTo({ top: (p / P_END) * maxScroll(), behavior: story.reduced ? 'auto' : 'smooth' });
    },
    [story],
  );
  const seek = useCallback((p: number) => {
    window.scrollTo({ top: (p / P_END) * maxScroll(), behavior: 'instant' });
  }, []);
  return { jump, seek };
}

export function useReducedMotion(story: Story): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      story.reduced = media.matches;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [story]);
}
