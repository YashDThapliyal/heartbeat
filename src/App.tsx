import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Scene } from './components/Scene';
import { StoryOverlay } from './components/StoryOverlay';
import { nextStop, previousStop } from './components/ChapterNav';
import { ExploreControls } from './components/ExploreControls';
import { Fallback, webglAvailable } from './components/Fallback';
import { createStory, type ExploreControls as Controls, type Quality } from './animation/story';
import { CHAPTERS, COPY, INTRO, P_END, chapterIndexAt } from './animation/chapters';
import { useReducedMotion, useScrollProgress } from './hooks/useScrollProgress';
import { useTickSound } from './hooks/useTickSound';
import { useTour } from './hooks/useTour';
import { useGlide } from './hooks/useGlide';
import { useContinueWhenWound } from './hooks/useContinueWhenWound';
import { useChapterLinks } from './hooks/useChapterLinks';
import { TourBar } from './components/TourBar';
import { requestTick } from './animation/interaction';
import type { PartId } from './movement/catalog';

/** Story length in viewport heights per unit of progress. */
const VH_PER_UNIT = 72;
/** Story units per second when the watch is opened by a click (about seven seconds). */
const OPENING_SPEED = 0.3;
const DEFAULT_CONTROLS: Controls = { playing: true, speed: 1, explode: 0.35, labels: true };

/**
 * How much interface to show. The intro is the watch alone; the landing adds
 * only the headline; everything else arrives once the watch starts to open.
 */
type Phase = 'intro' | 'landing' | 'story';

function phaseAt(p: number): Phase {
  if (p < INTRO * 0.55) return 'intro';
  if (p < CHAPTERS[1].start + 0.25) return 'landing';
  return 'story';
}

class SceneBoundary extends Component<{ children: ReactNode; onFailure: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onFailure(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function App() {
  const story = useRef(createStory()).current;
  const labelsRoot = useRef<HTMLDivElement>(null);
  const modeToggle = useRef<HTMLButtonElement>(null);
  const [supported] = useState(webglAvailable);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [quality, setQuality] = useState<Quality>('high');
  const [sound, setSound] = useState(false);
  /** The viewer's explicit sound choice; until they make one, a gesture turns it on. */
  const soundChoice = useRef<boolean | null>(null);
  const wantSound = useCallback(() => {
    if (soundChoice.current === null) setSound(true);
  }, []);

  useReducedMotion(story);
  const { jump, seek } = useScrollProgress(story);
  const tour = useTour(story, seek, wantSound);
  const { pause: pauseTour, toggle: toggleTour } = tour;
  const glide = useGlide(story, seek);
  useContinueWhenWound(story, glide);
  useEffect(() => {
    story.touring = tour.playing;
  }, [story, tour.playing]);
  useTickSound(story, sound && ready);

  useChapterLinks(chapterIndex, ready, seek);

  // Coarse UI state follows the story a few times a second, not every frame.
  useEffect(() => {
    const id = window.setInterval(() => {
      setChapterIndex(chapterIndexAt(story.p));
      setBeatIndex(COPY.findIndex(c => story.p >= c.from && story.p < c.to));
      setPhase(phaseAt(story.p));
    }, 90);
    return () => window.clearInterval(id);
  }, [story]);

  const select = useCallback(
    (id: PartId | null) => {
      story.selected = id;
      setSelected(id);
    },
    [story],
  );

  const changeControls = useCallback(
    (next: Controls) => {
      story.controls = next;
      setControls(next);
    },
    [story],
  );

  /** Clicking the watch plays the opening at a deliberate pace, piece by piece. */
  const openWatch = useCallback(() => {
    pauseTour();
    glide(CHAPTERS[1].settle, OPENING_SPEED);
  }, [pauseTour, glide]);

  const enterExplore = useCallback(() => {
    pauseTour();
    story.explore = true;
    story.hovered = null;
    changeControls(DEFAULT_CONTROLS);
    document.documentElement.classList.add('is-exploring');
    setExploring(true);
  }, [story, changeControls, pauseTour]);

  const exitExplore = useCallback(() => {
    story.explore = false;
    story.hovered = null;
    select(null);
    document.documentElement.classList.remove('is-exploring');
    document.body.style.cursor = '';
    setExploring(false);
    // Return keyboard focus to the control that toggles modes.
    requestAnimationFrame(() => modeToggle.current?.focus());
  }, [story, select]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && story.explore) exitExplore();
      const typing = e.target instanceof HTMLElement && e.target.closest('input, select, textarea');
      if (story.explore || typing || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        // In the escapement close-up, Space lets one beat through; elsewhere it plays the tour.
        if (story.frame.handsOn === 'tick') {
          requestTick(story.interact, story.time);
          wantSound();
        } else {
          toggleTour();
        }
        return;
      }
      if (e.key === 'Enter' && story.p < CHAPTERS[1].start && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        openWatch();
        return;
      }
      const stop = e.key === 'ArrowRight' ? nextStop(story.targetP) : e.key === 'ArrowLeft' ? previousStop(story.targetP) : null;
      if (stop === null) return;
      e.preventDefault();
      jump(stop);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [story, exitExplore, jump, toggleTour, wantSound, openWatch]);

  const onFailure = useCallback((error: unknown) => {
    console.error('3D scene failed', error);
    setFailed(true);
    setReady(true);
  }, []);
  const onReady = useCallback(() => setReady(true), []);

  if (!supported || failed) {
    return (
      <main className="experience static">
        <Fallback />
      </main>
    );
  }

  return (
    <main className={`experience phase-${exploring ? 'story' : phase}${exploring ? ' exploring' : ''}${tour.playing ? ' touring' : ''}${quality === 'low' ? ' low' : ''}`}>
      <div className="stage" aria-label="Interactive 3D model of a mechanical watch movement">
        <SceneBoundary onFailure={onFailure}>
          <Scene
            story={story}
            exploring={exploring}
            resetKey={resetKey}
            labelsRoot={labelsRoot}
            onSelect={select}
            onReady={onReady}
            onQualityChange={setQuality}
            onGesture={wantSound}
            onOpen={openWatch}
          />
        </SceneBoundary>
        <div className="labels" ref={labelsRoot} aria-hidden="true" />
        <div className="scrim" aria-hidden="true" />
      </div>

      <header className="masthead">
        <button type="button" className="wordmark" onClick={() => (exploring ? exitExplore() : jump(0))}>
          Heartbeat <span>01</span>
        </button>
        <div className="masthead-actions">
          {!exploring && (
            <button type="button" className={`tour-button${tour.playing ? ' playing' : ''}`} aria-pressed={tour.playing} onClick={tour.toggle}>
              <span className="tour-icon" aria-hidden="true">
                {tour.playing ? '❚❚' : '▶'}
              </span>
              {tour.playing ? 'Pause tour' : 'Play tour'}
            </button>
          )}
          <button type="button" className="text-button quiet" aria-pressed={sound} onClick={() => {
              soundChoice.current = !sound;
              setSound(!sound);
            }}>
            Sound {sound ? 'on' : 'off'}
          </button>
          <button ref={modeToggle} type="button" className="text-button" onClick={exploring ? exitExplore : enterExplore}>
            {exploring ? (
              <>
                <span className="long">Back to the story</span>
                <span className="short">Story</span>
              </>
            ) : (
              'Explore'
            )}{' '}
            <span aria-hidden="true">{exploring ? '↩' : '↗'}</span>
          </button>
        </div>
      </header>

      {exploring ? (
        <ExploreControls
          value={controls}
          selected={selected}
          onChange={changeControls}
          onSelect={select}
          onReset={() => {
            select(null);
            changeControls(DEFAULT_CONTROLS);
            setResetKey(k => k + 1);
          }}
          onExit={exitExplore}
        />
      ) : (
        <StoryOverlay
          story={story}
          beatIndex={beatIndex}
          chapterIndex={chapterIndex}
          onJump={p => {
            tour.pause();
            jump(p);
          }}
          onExplore={enterExplore}
          onGesture={wantSound}
          tour={tour}
        />
      )}

      {!exploring && tour.playing && <TourBar tour={tour} story={story} />}

      <div className="scroll-space" style={{ height: `${P_END * VH_PER_UNIT + 100}vh` }} aria-hidden="true" />

      <div className={`loading${ready ? ' done' : ''}`} role="status" aria-hidden={ready}>
        <p>Assembling movement</p>
        <div className="loading-line" />
      </div>
      <p className="sr-only">
        {CHAPTERS[chapterIndex].name}
      </p>
    </main>
  );
}
