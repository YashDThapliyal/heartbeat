import { useEffect } from 'react';
import type { Story } from '../animation/story';
import { WOUND } from '../animation/interaction';
import { CHAPTERS } from '../animation/chapters';

/** Pause to admire the wound spring, then move on (the tour handles its own pacing). */
const ADMIRE_SECONDS = 1.4;
const CONTINUE_SPEED = 0.35;

/**
 * Once the viewer has fully wound the mainspring, carry on into the gear train
 * by itself, so there is nothing left to press.
 */
export function useContinueWhenWound(story: Story, glide: (to: number, speed: number) => void): void {
  useEffect(() => {
    const next = CHAPTERS.find(c => c.id === 'train');
    if (!next) return;
    let woundAt: number | null = null;
    let done = false;
    const id = window.setInterval(() => {
      const wound = story.frame.handsOn === 'wind' && story.interact.wind >= WOUND;
      if (!wound) {
        woundAt = null;
        // Winding again (after scrolling back) earns another automatic continue.
        if (story.interact.wind < 0.5) done = false;
        return;
      }
      if (done || story.touring || story.explore) return;
      woundAt ??= performance.now();
      if (performance.now() - woundAt > ADMIRE_SECONDS * 1000) {
        done = true;
        glide(next.settle, CONTINUE_SPEED);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [story, glide]);
}
