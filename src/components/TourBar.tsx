/**
 * While the tour plays: a slim bar at the bottom showing how long until it
 * moves on, a Next control, and, at the hands-on moments, what to do.
 */
import { useRef } from 'react';
import type { Tour } from '../hooks/useTour';
import type { Story } from '../animation/story';
import { useAnimationLoop } from '../hooks/useAnimationLoop';

const PROMPTS = {
  wind: 'Your turn: turn the glowing crown, or drag across the watch',
  tick: 'Your turn: tap the watch for TICK, then TOCK',
  demo: 'Watch closely: one beat in slow motion',
} as const;

export function TourBar({ tour, story }: { tour: Tour; story: Story }) {
  const ring = useRef<SVGCircleElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useAnimationLoop(() => {
    const s = tour.status.current;
    const circumference = 2 * Math.PI * 9;
    if (ring.current) {
      const shown = s.phase === 'hold' || s.phase === 'wait' ? s.progress : 0;
      ring.current.style.strokeDashoffset = String(circumference * (1 - Math.min(1, shown)));
    }
    const demo = s.waitFor === 'tick' && story.interact.tick.demo.state !== 'done';
    const text = s.phase === 'wait' && s.waitFor ? PROMPTS[demo ? 'demo' : s.waitFor] : 'Guided tour';
    if (label.current && label.current.textContent !== text) label.current.textContent = text;
    root.current?.classList.toggle('waiting', s.phase === 'wait');
  });

  return (
    <div className="tour-bar" ref={root} role="status">
      <svg className="tour-ring" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="9" className="track" />
        <circle ref={ring} cx="11" cy="11" r="9" className="fill" strokeDasharray={2 * Math.PI * 9} />
      </svg>
      <span ref={label} className="tour-label">
        Guided tour
      </span>
      <button type="button" onClick={tour.next}>
        Next <span aria-hidden="true">›</span>
      </button>
      <button type="button" className="quiet" onClick={tour.pause}>
        Stop
      </button>
    </div>
  );
}
