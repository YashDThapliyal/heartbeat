/**
 * Small live instruments shown beside the copy. Values come from the running
 * simulation and its configuration; they are updated in place every frame.
 */
import { useRef } from 'react';
import type { Story } from '../animation/story';
import { IDEAS, type Readout as ReadoutKind } from '../animation/chapters';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { ARBORS, BALANCE_HZ, BEATS_PER_SECOND, WINDING } from '../movement/config';
import { revolutionSeconds } from '../movement/simulation';
import { CATALOG } from '../movement/catalog';
import type { Tour } from '../hooks/useTour';
import { WOUND, nextBeatWord, requestTick } from '../animation/interaction';

const BEATS_PER_HOUR = BEATS_PER_SECOND * 3600;
const BARREL_HOURS = revolutionSeconds('barrel') / 3600;
const POWER_RESERVE_HOURS = WINDING.barrelTurnsFull * BARREL_HOURS;

export function formatPeriod(seconds: number): string {
  if (seconds >= 3600) return `${+(seconds / 3600).toFixed(1)} h`;
  if (seconds >= 60) {
    const min = seconds / 60;
    return Number.isInteger(min) ? `${min} min` : `${Math.floor(min)}½ min`;
  }
  return `${+seconds.toFixed(1)} s`;
}

export function formatRate(rate: number): string {
  if (rate >= 10) return `×${Math.round(rate).toLocaleString('en-US')}`;
  if (rate >= 0.995) return `×${+rate.toFixed(1)}`;
  return `×${rate.toFixed(2)}`;
}

/** The four moments of every beat (their explanations sit beside the stones). */
const STEPS = [
  { phase: 'LOCK', name: 'Locked' },
  { phase: 'UNLOCK', name: 'Unlock' },
  { phase: 'IMPULSE', name: 'Impulse' },
  { phase: 'DROP', name: 'Drop' },
] as const;

const STAGE_NAMES: Record<string, string> = {
  barrel: 'Barrel',
  center: 'Centre',
  third: 'Third',
  fourth: 'Fourth',
  escape: 'Escape',
};

interface Props {
  kind: ReadoutKind;
  story: Story;
  onExplore: () => void;
  onGesture: () => void;
  tour: Tour;
}

export function Readout({ kind, story, onExplore, onGesture, tour }: Props) {
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const c = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const stages = useRef<(HTMLLIElement | null)[]>([]);
  const steps = useRef<(HTMLLIElement | null)[]>([]);
  const holdButton = useRef<HTMLButtonElement>(null);
  const tickButton = useRef<HTMLButtonElement>(null);
  const d = useRef<HTMLSpanElement>(null);

  useAnimationLoop(() => {
    const m = story.mech;
    const f = story.frame;
    const set = (el: HTMLElement | null, text: string) => {
      if (el && el.textContent !== text) el.textContent = text;
    };
    switch (kind) {
      case 'wind': {
        set(a.current, `${Math.round(f.wind * POWER_RESERVE_HOURS)} h`);
        set(b.current, `${Math.round(f.winding * WINDING.crownTurnsForFullWind)}`);
        const wound = f.wind >= WOUND;
        set(c.current, wound ? 'Fully wound' : 'Hold to wind');
        if (holdButton.current) {
          holdButton.current.disabled = wound;
          holdButton.current.classList.toggle('done', wound);
          holdButton.current.parentElement?.classList.toggle('wound', wound);
        }
        if (wound) story.interact.windHeld = false;
        if (bar.current) bar.current.style.transform = `scaleX(${f.wind})`;
        break;
      }
      case 'train': {
        const active = Math.max(0, Math.min(ARBORS.length - 1, Math.round(f.energy)));
        stages.current.forEach((el, i) => el?.classList.toggle('active', i === active));
        const arbor = ARBORS[active];
        set(a.current, STAGE_NAMES[arbor.id]);
        set(b.current, `1 turn / ${formatPeriod(revolutionSeconds(arbor.id))}`);
        set(c.current, formatRate(m.rate));
        break;
      }
      case 'escapement': {
        const tick = story.interact.tick;
        const demo = tick.demo.state !== 'done';
        const resting = !demo && story.time >= tick.holdAt - 1e-9;
        const next = nextBeatWord(story.interact);
        set(a.current, resting ? next : m.escapement.tick);
        a.current?.classList.toggle('waiting', resting);
        const active = STEPS.findIndex(st => st.phase === m.escapement.phase);
        steps.current.forEach((el, i) => el?.classList.toggle('active', i === active));
        set(
          b.current,
          demo
            ? 'Watch one beat in slow motion, step by step.'
            : tick.count === 0
              ? 'Your turn. Tap the watch to let one beat through.'
              : `Your turn. ${tick.count} ${tick.count === 1 ? 'beat' : 'beats'} so far.`,
        );
        set(d.current, demo ? 'Skip to my turn' : `Tap for ${next}`);
        tickButton.current?.classList.toggle('quiet', demo);
        break;
      }
      case 'heart':
      case 'time':
        set(c.current, formatRate(m.rate));
        break;
      case 'hover': {
        const id = story.hovered;
        set(a.current, id ? CATALOG[id].name : 'Point at a component');
        set(b.current, id ? CATALOG[id].role : '');
        break;
      }
      default:
        break;
    }
  });

  switch (kind) {
    case 'scroll':
      return (
        <div className="readout readout-start">
          <button type="button" className="play-tour" onClick={tour.toggle}>
            <span className="play-disc" aria-hidden="true">
              {tour.playing ? '❚❚' : '▶'}
            </span>
            <span>
              {tour.playing ? 'Pause the tour' : 'Play the tour'}
              <small>About a minute and a half · with two things to try</small>
            </span>
          </button>
        </div>
      );
    case 'ideas':
      return (
        <ol className="ideas">
          {IDEAS.map((idea, i) => (
            <li key={idea.idea}>
              <span className="idea-num">{i + 1}</span>
              <span className="idea-word">{idea.idea}</span>
              <span className="idea-part">{idea.part}</span>
              <span className="idea-line">{idea.line}</span>
            </li>
          ))}
        </ol>
      );
    case 'wind':
      return (
        <div className="readout hands-on">
          <div className="meter">
            <div ref={bar} className="meter-fill" />
          </div>
          <dl className="pairs">
            <div>
              <dt>Power reserve</dt>
              <dd ref={a}>0 h</dd>
            </div>
            <div>
              <dt>Crown turns</dt>
              <dd ref={b}>0</dd>
            </div>
          </dl>
          <button
            ref={holdButton}
            type="button"
            className="hold-button"
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId);
              story.interact.windHeld = true;
              onGesture();
            }}
            onPointerUp={() => {
              story.interact.windHeld = false;
            }}
            onPointerCancel={() => {
              story.interact.windHeld = false;
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                story.interact.windHeld = true;
                onGesture();
              }
            }}
            onKeyUp={() => {
              story.interact.windHeld = false;
            }}
          >
            <span className="hold-icon" aria-hidden="true" />
            <span ref={c}>Hold to wind</span>
          </button>
          <span className="hint">or drag across the watch</span>
        </div>
      );
    case 'train':
      return (
        <div className="readout">
          <ol className="stages" aria-label="Energy path">
            {ARBORS.map((arbor, i) => (
              <li key={arbor.id} ref={el => { stages.current[i] = el; }}>
                {STAGE_NAMES[arbor.id]}
              </li>
            ))}
          </ol>
          <dl className="pairs">
            <div>
              <dt ref={a}>Barrel</dt>
              <dd ref={b}>1 turn / 8 h</dd>
            </div>
            <div>
              <dt>Time-lapse</dt>
              <dd ref={c}>×1</dd>
            </div>
          </dl>
        </div>
      );
    case 'escapement':
      return (
        <div className="readout readout-escapement hands-on">
          <div className="beat">
            <span ref={a} className="beat-word">TICK</span>
          </div>
          <ol className="steps" aria-label="The four steps of every beat">
            {STEPS.map((st, i) => (
              <li key={st.phase} ref={el => { steps.current[i] = el; }}>
                <span>{i + 1}</span>
                {st.name}
              </li>
            ))}
          </ol>
          <span ref={b} className="hint lead">
            Watch one beat in slow motion, step by step.
          </span>
          <button
            ref={tickButton}
            type="button"
            className="tick-button"
            onClick={() => {
              requestTick(story.interact, story.time);
              onGesture();
            }}
          >
            <span className="tick-dot" aria-hidden="true" />
            <span ref={d}>Skip to my turn</span>
            <kbd>Space</kbd>
          </button>
        </div>
      );
    case 'heart':
      return (
        <div className="readout">
          <dl className="pairs">
            <div>
              <dt>Frequency</dt>
              <dd>{BALANCE_HZ} Hz</dd>
            </div>
            <div>
              <dt>Beats / hour</dt>
              <dd>{BEATS_PER_HOUR.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>Shown at</dt>
              <dd ref={c}>×0.16</dd>
            </div>
          </dl>
        </div>
      );
    case 'time':
      return (
        <div className="readout">
          <dl className="pairs">
            <div>
              <dt>Centre wheel</dt>
              <dd>Minutes · 1 turn / h</dd>
            </div>
            <div>
              <dt>Fourth wheel</dt>
              <dd>Seconds · 1 turn / min</dd>
            </div>
            <div>
              <dt>Time-lapse</dt>
              <dd ref={c}>×60</dd>
            </div>
          </dl>
        </div>
      );
    case 'hover':
      return (
        <div className="readout readout-hover" aria-live="polite">
          <strong ref={a}>Point at a component</strong>
          <span ref={b} />
        </div>
      );
    case 'explore':
      return (
        <div className="ending">
          <div className="end-actions">
            <button type="button" className="text-button" onClick={onExplore}>
              Explore the movement <span aria-hidden="true">↗</span>
            </button>
            <button type="button" className="text-button quiet" onClick={tour.play}>
              Replay tour <span aria-hidden="true">↺</span>
            </button>
          </div>
          <p className="credit">Made by Yash Thapliyal · 2026</p>
        </div>
      );
    default:
      return null;
  }
}
