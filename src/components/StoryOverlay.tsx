/**
 * The sparse text layer over the scene: one short copy beat at a time, and the
 * chapter navigator.
 */
import { useRef } from 'react';
import type { Story } from '../animation/story';
import { COPY, copyOpacity } from '../animation/chapters';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { Readout } from './Readouts';
import { ChapterNav } from './ChapterNav';
import type { Tour } from '../hooks/useTour';

interface Props {
  story: Story;
  beatIndex: number;
  chapterIndex: number;
  onJump: (p: number) => void;
  onExplore: () => void;
  onGesture: () => void;
  tour: Tour;
}

export function StoryOverlay({ story, beatIndex, chapterIndex, onJump, onExplore, onGesture, tour }: Props) {
  const copy = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const beat = beatIndex >= 0 ? COPY[beatIndex] : null;

  useAnimationLoop(() => {
    if (copy.current && beat) copy.current.style.opacity = String(copyOpacity(beat, story.p));
    // The scroll hint leaves as soon as the viewer starts scrolling.
    if (hint.current) hint.current.style.opacity = String(Math.max(0, 1 - story.p / 0.06));
  });

  return (
    <>
      {beat && (
        <section className="copy" ref={copy} key={beatIndex} aria-live="polite">
          {beat.eyebrow && <p className="eyebrow">{beat.eyebrow}</p>}
          {beat.title && (
            <h1>
              {beat.title.split('\n').map((line, i) => (
                <span key={i} className="line">
                  <span style={{ animationDelay: `${120 + i * 90}ms` }}>{line}</span>
                </span>
              ))}
            </h1>
          )}
          {(tour.playing ? beat.tour : beat.body) && <p className="body">{tour.playing ? beat.tour : beat.body}</p>}
          {beat.readout && <Readout kind={beat.readout} story={story} onExplore={onExplore} onGesture={onGesture} tour={tour} />}
        </section>
      )}

      <div className="intro-hint" ref={hint} aria-hidden={story.p > 0.06}>
        <div className="intro-pill">
          <span className="tap-icon" aria-hidden="true" />
          Click the watch to open
          <span className="pill-divider" aria-hidden="true" />
          <span className="pill-quiet">Drag to turn</span>
        </div>
      </div>

      <ChapterNav story={story} chapterIndex={chapterIndex} onJump={onJump} />
    </>
  );
}
