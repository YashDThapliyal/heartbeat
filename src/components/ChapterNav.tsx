/**
 * The chapter navigator: nine named stops along the bottom of the screen.
 * The five ideas (Store → Display) are linked as the "power path". The active
 * stop shows how far through it you are; any stop can be clicked.
 */
import { useRef } from 'react';
import type { Story } from '../animation/story';
import { CHAPTERS, P_END } from '../animation/chapters';
import { useAnimationLoop } from '../hooks/useAnimationLoop';

interface Props {
  story: Story;
  chapterIndex: number;
  onJump: (p: number) => void;
}

const chapterEnd = (i: number) => (i + 1 < CHAPTERS.length ? CHAPTERS[i + 1].start : P_END);

export function nextStop(p: number): number | null {
  const next = CHAPTERS.find(c => c.settle > p + 0.03);
  return next ? next.settle : null;
}

export function previousStop(p: number): number | null {
  const earlier = CHAPTERS.filter(c => c.settle < p - 0.03);
  return earlier.length ? earlier[earlier.length - 1].settle : null;
}

export function ChapterNav({ story, chapterIndex, onJump }: Props) {
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const total = useRef<HTMLDivElement>(null);

  useAnimationLoop(() => {
    const p = story.p;
    fills.current.forEach((el, i) => {
      if (!el) return;
      const c = CHAPTERS[i];
      const f = Math.max(0, Math.min(1, (p - c.start) / (chapterEnd(i) - c.start)));
      el.style.transform = `scaleX(${f})`;
    });
    if (total.current) total.current.style.transform = `scaleX(${Math.min(1, p / P_END)})`;
  });

  const current = CHAPTERS[chapterIndex];
  const prev = previousStop(story.p);
  const next = nextStop(story.p);

  return (
    <nav className="chapter-nav" aria-label="Chapters">
      <div className="nav-total" aria-hidden="true">
        <div ref={total} />
      </div>
      <ol className="nav-stops">
        {CHAPTERS.map((c, i) => {
          const state = i === chapterIndex ? 'current' : i < chapterIndex ? 'past' : 'future';
          return (
            <li key={c.id} className={`nav-stop ${state}${c.idea ? ' idea' : ''}`}>
              <button type="button" onClick={() => onJump(c.settle)} aria-current={i === chapterIndex ? 'step' : undefined}>
                <span className="nav-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="nav-name">{c.short}</span>
                <span className="nav-fill" aria-hidden="true">
                  <span ref={el => { fills.current[i] = el; }} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="nav-compact">
        <button type="button" aria-label="Previous chapter" disabled={prev === null} onClick={() => prev !== null && onJump(prev)}>
          ‹
        </button>
        <span>
          <em>{String(chapterIndex + 1).padStart(2, '0')}</em> {current.name}
        </span>
        <button type="button" aria-label="Next chapter" disabled={next === null} onClick={() => next !== null && onJump(next)}>
          ›
        </button>
      </div>
      <p className="nav-hint" aria-hidden="true">
        <kbd>←</kbd> <kbd>→</kbd> chapters
      </p>
    </nav>
  );
}
