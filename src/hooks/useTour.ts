import { useCallback, useEffect, useRef, useState } from 'react';
import type { Story } from '../animation/story';
import { INTRO, P_END, copyAt } from '../animation/chapters';
import { smootherstep } from '../movement/simulation';
import { WOUND } from '../animation/interaction';

/**
 * A guided tour: the story plays itself, travelling between stops and pausing
 * at each long enough to read. At the two hands-on moments it waits for the
 * viewer (wind the crown, tap to tick), and moves on by itself if they don't.
 */
export type WaitFor = 'wind' | 'tick';

interface Stop {
  /** Story units (after the intro). */
  at: number;
  /** Seconds to hold once arrived (after any wait). */
  hold: number;
  /** Travel speed on the way here, in story units per second. */
  speed: number;
  waitFor?: WaitFor;
}

const STORY_STOPS: readonly Stop[] = [
  { at: 0, hold: 1.5, speed: 0.4 },
  { at: 1.82, hold: 1.5, speed: 0.28 },
  { at: 2.6, hold: 2, speed: 0.5 },
  { at: 3.3, hold: 1.5, speed: 0.4 },
  { at: 3.62, hold: 1.2, speed: 0.4, waitFor: 'wind' },
  { at: 4.02, hold: 1.2, speed: 0.4 },
  { at: 4.35, hold: 1, speed: 0.4 },
  { at: 5.22, hold: 2, speed: 0.1 },
  { at: 5.72, hold: 1.5, speed: 0.4 },
  { at: 6.1, hold: 1.5, speed: 0.4, waitFor: 'tick' },
  { at: 7.05, hold: 1.5, speed: 0.4 },
  { at: 7.95, hold: 1.5, speed: 0.4 },
  { at: 8.66, hold: 1, speed: 0.5 },
  { at: P_END - INTRO, hold: 2, speed: 0.26 },
];

/** Page positions of every tour stop (for tests). */
export function tourStops(): number[] {
  return STORY_STOPS.map(stop => stop.at + INTRO);
}

/** Comfortable reading pace for on-screen copy, in words per second. */
const READING_WPS = 2.6;

/** Seconds needed to read the copy shown at a page position (0 if none). */
function readingTime(pageP: number): number {
  const beat = copyAt(pageP);
  if (!beat) return 0;
  const words = `${beat.title} ${beat.tour ?? ''}`.split(/\s+/).filter(Boolean).length;
  return 1.2 + words / READING_WPS;
}

/** Longest the tour waits for the viewer before carrying on (the tick wait includes the slow-motion demo). */
export const MAX_WAIT: Record<WaitFor, number> = { wind: 14, tick: 28 };
/** Taps the tour asks for before it moves on: one tick, one tock. */
export const TICKS_WANTED = 2;

type Segment =
  | { kind: 'travel'; from: number; to: number; duration: number }
  | { kind: 'hold'; at: number; duration: number }
  | { kind: 'wait'; at: number; waitFor: WaitFor };

function planFrom(pageP: number): Segment[] {
  const segments: Segment[] = [];
  let at = pageP;
  // Time already spent with the current copy on screen (travelling within it counts).
  let beatTitle: string | undefined;
  let beatTime = 0;
  for (const stop of STORY_STOPS) {
    const target = stop.at + INTRO;
    if (target < pageP + 0.01) continue;
    const travel = Math.max(0.6, Math.abs(target - at) / stop.speed);
    segments.push({ kind: 'travel', from: at, to: target, duration: travel });
    const title = copyAt(target)?.title;
    beatTime = title && title === beatTitle ? beatTime + travel : travel * 0.5;
    beatTitle = title;
    if (stop.waitFor) segments.push({ kind: 'wait', at: target, waitFor: stop.waitFor });
    const hold = Math.max(stop.hold, readingTime(target) - beatTime);
    if (hold > 0) segments.push({ kind: 'hold', at: target, duration: hold });
    beatTime += hold;
    at = target;
  }
  return segments;
}

/** Tour length in seconds, not counting time spent on the hands-on moments. */
export const TOUR_SECONDS = Math.round(
  planFrom(0).reduce((t, s) => t + (s.kind === 'wait' ? 0 : s.duration), 0),
);

/** Live tour state for the UI, read every frame (no React state). */
export interface TourStatus {
  phase: 'idle' | 'travel' | 'hold' | 'wait';
  /** 0..1 through the current hold or wait. */
  progress: number;
  waitFor: WaitFor | null;
}

export interface Tour {
  playing: boolean;
  status: React.RefObject<TourStatus>;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Skip the current hold or wait and carry on. */
  next: () => void;
}

function waitDone(story: Story, waitFor: WaitFor): boolean {
  if (waitFor === 'wind') return story.interact.wind >= WOUND;
  const tick = story.interact.tick;
  // Let the last tapped beat finish before moving on.
  return tick.count >= TICKS_WANTED && story.time >= tick.holdAt - 1e-9;
}

export function useTour(story: Story, scrollTo: (p: number) => void, onStart?: () => void): Tour {
  const [playing, setPlaying] = useState(false);
  const plan = useRef<{ segments: Segment[]; index: number; elapsed: number } | null>(null);
  const status = useRef<TourStatus>({ phase: 'idle', progress: 0, waitFor: null });

  const pause = useCallback(() => {
    plan.current = null;
    status.current = { phase: 'idle', progress: 0, waitFor: null };
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (story.explore) return;
    const start = story.targetP >= P_END - 0.05 ? 0 : story.targetP;
    if (start === 0 && story.targetP > 0) scrollTo(0);
    plan.current = { segments: planFrom(start - 0.02), index: 0, elapsed: 0 };
    setPlaying(true);
    onStart?.();
  }, [story, scrollTo, onStart]);

  const toggle = useCallback(() => (plan.current ? pause() : play()), [pause, play]);

  const next = useCallback(() => {
    const run = plan.current;
    if (!run) return;
    // Skip every hold/wait at the current stop, straight to the next journey.
    let i = run.index;
    while (run.segments[i] && run.segments[i].kind !== 'travel') i++;
    if (i === run.index && run.segments[i]?.kind === 'travel') {
      i++;
      while (run.segments[i] && run.segments[i].kind !== 'travel') i++;
    }
    run.index = i;
    run.elapsed = 0;
  }, []);

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const run = plan.current;
      if (!run || story.explore) {
        pause();
        return;
      }
      run.elapsed += dt;
      let seg = run.segments[run.index];
      for (;;) {
        if (!seg) break;
        const finished =
          seg.kind === 'wait' ? waitDone(story, seg.waitFor) || run.elapsed >= MAX_WAIT[seg.waitFor] : run.elapsed >= seg.duration;
        if (!finished) break;
        run.elapsed = seg.kind === 'wait' ? 0 : run.elapsed - seg.duration;
        run.index++;
        seg = run.segments[run.index];
      }
      if (!seg) {
        scrollTo(P_END);
        pause();
        return;
      }
      if (seg.kind === 'travel') {
        scrollTo(seg.from + (seg.to - seg.from) * smootherstep(run.elapsed / seg.duration));
        status.current = { phase: 'travel', progress: 0, waitFor: null };
      } else if (seg.kind === 'hold') {
        scrollTo(seg.at);
        status.current = { phase: 'hold', progress: run.elapsed / seg.duration, waitFor: null };
      } else {
        scrollTo(seg.at);
        status.current = { phase: 'wait', progress: run.elapsed / MAX_WAIT[seg.waitFor], waitFor: seg.waitFor };
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);

    // Scrolling or navigating hands control back to the viewer. Gestures that
    // belong to a hands-on moment (winding, tapping) do not.
    const interrupt = () => pause();
    const onTouch = () => {
      if (!story.frame.handsOn) pause();
    };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) pause();
    };
    window.addEventListener('wheel', interrupt, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('wheel', interrupt);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('keydown', onKey);
    };
  }, [playing, story, scrollTo, pause]);

  return { playing, status, play, pause, toggle, next };
}
