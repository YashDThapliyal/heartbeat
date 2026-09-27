/**
 * Chapter boundaries (in story progress units) and the few words shown with them.
 * Copy is deliberately sparse: the mechanism does the explaining.
 */

/**
 * The story opens with an intro: just the watch, centred, and a scroll hint.
 * Everything else is authored in "story units" and shifted by INTRO here.
 */
export const INTRO = 0.35;
const STORY_END = 9.4;
export const P_END = STORY_END + INTRO;

export type ChapterId =
  | 'hero'
  | 'open'
  | 'anatomy'
  | 'energy'
  | 'train'
  | 'escapement'
  | 'heart'
  | 'time'
  | 'finale';

/** The five ideas every mechanical watch is built from. */
export type Idea = 'Store' | 'Transmit' | 'Release' | 'Regulate' | 'Display';

export const IDEAS: readonly { idea: Idea; part: string; line: string }[] = [
  { idea: 'Store', part: 'Mainspring', line: 'Your hand winds a spring.' },
  { idea: 'Transmit', part: 'Gear train', line: 'Gears carry its push onward.' },
  { idea: 'Release', part: 'Escapement', line: 'It is let go in tiny steps.' },
  { idea: 'Regulate', part: 'Balance', line: 'A swinging wheel sets the pace.' },
  { idea: 'Display', part: 'Hands', line: 'The steps are counted as time.' },
];

export interface Chapter {
  id: ChapterId;
  name: string;
  /** Short label for the chapter navigator. */
  short: string;
  /** Which of the five ideas the chapter explains, if any. */
  idea?: Idea;
  start: number;
  /** Where the navigator jumps to: a settled, readable composition. */
  settle: number;
}

const STORY_CHAPTERS: readonly Chapter[] = [
  { id: 'hero', name: 'The watch', short: 'Watch', start: -INTRO, settle: -INTRO },
  { id: 'open', name: 'Beneath the dial', short: 'Inside', start: 0.8, settle: 1.82 },
  { id: 'anatomy', name: 'Five ideas', short: 'Overview', start: 1.9, settle: 2.6 },
  { id: 'energy', name: 'Stored energy', short: 'Store', idea: 'Store', start: 3.0, settle: 3.55 },
  { id: 'train', name: 'The gear train', short: 'Transmit', idea: 'Transmit', start: 4.1, settle: 4.3 },
  { id: 'escapement', name: 'The escapement', short: 'Release', idea: 'Release', start: 5.35, settle: 6.0 },
  { id: 'heart', name: 'The balance', short: 'Regulate', idea: 'Regulate', start: 6.65, settle: 7.05 },
  { id: 'time', name: 'Time', short: 'Display', idea: 'Display', start: 7.5, settle: 7.95 },
  { id: 'finale', name: 'Reassembly', short: 'Whole', start: 8.3, settle: STORY_END },
];

export const CHAPTERS: readonly Chapter[] = STORY_CHAPTERS.map(c => ({ ...c, start: c.start + INTRO, settle: c.settle + INTRO }));

export function chapterIndexAt(p: number): number {
  let index = 0;
  for (let i = 0; i < CHAPTERS.length; i++) if (p >= CHAPTERS[i].start - 0.02) index = i;
  return index;
}

export type Readout = 'scroll' | 'ideas' | 'wind' | 'train' | 'escapement' | 'heart' | 'time' | 'explore' | 'hover';

export interface CopyBeat {
  from: number;
  to: number;
  eyebrow: string;
  title: string;
  body?: string;
  /** One short line shown instead of the body during the guided tour. */
  tour?: string;
  readout?: Readout;
}

const STORY_COPY: readonly CopyBeat[] = [
  {
    from: -0.16,
    to: 0.5,
    eyebrow: '',
    title: 'Seventeen jewels.\nOne heartbeat.',
    readout: 'scroll',
  },
  {
    from: 1.62,
    to: 1.95,
    eyebrow: '',
    title: 'Beneath the dial,\ntime becomes mechanical.',
    tour: 'Every part has exactly one job.',
  },
  {
    from: 2.3,
    to: 2.98,
    eyebrow: 'Overview',
    title: 'Five ideas.\nOne machine.',
    tour: 'Five steps. We’ll follow them in order.',
    body: 'Every mechanical watch works the same way. Keep these five steps in mind; we will follow them in order.',
    readout: 'ideas',
  },
  {
    from: 3.12,
    to: 3.48,
    eyebrow: '1 · Store',
    title: 'It begins\nwith your hand.',
    tour: 'Turning the crown winds a steel spring.',
    body: 'Turning the crown winds a long steel ribbon, the mainspring, tight inside a drum. Like winding a toy car.',
  },
  {
    from: 3.52,
    to: 4.08,
    eyebrow: '1 · Store',
    title: 'Now you\nwind it.',
    tour: 'Drag across the watch to wind it.',
    body: 'Watch the mainspring coil tighter around its arbor. That push to unwind is the only energy the watch has.',
    readout: 'wind',
  },
  {
    from: 4.18,
    to: 5.3,
    eyebrow: '2 · Transmit',
    title: 'Follow\nthe energy.',
    tour: 'Each wheel spins the next one faster.',
    body: 'Each big wheel turns a smaller one, so every step spins faster, like bicycle gears. The barrel turns once in 8 hours; the last wheel, every 6 seconds.',
    readout: 'train',
  },
  {
    from: 5.42,
    to: 5.86,
    eyebrow: '3 · Release',
    title: 'Left alone, the gears\nwould simply race.',
    tour: 'Without a brake, the spring would empty in seconds.',
    body: 'The spring would empty in seconds. Something has to hold it back, and let it go in small, even steps.',
  },
  {
    from: 5.9,
    to: 6.62,
    eyebrow: '3 · Release',
    title: 'Lock. Release.\nLock again.',
    tour: 'Watch one beat slowly. Then it’s your turn.',
    body: 'Like a turnstile, the pallet fork lets the escape wheel through one step at a time. Watch one beat slowly, then play it yourself.',
    readout: 'escapement',
  },
  {
    from: 6.72,
    to: 7.46,
    eyebrow: '4 · Regulate',
    title: 'The heart\nof the watch.',
    tour: 'Its steady swing sets the pace of every tick.',
    body: 'The balance swings back and forth like a pendulum, five swings a second. Its hairspring makes every swing last the same time, so every step comes on the beat.',
    readout: 'heart',
  },
  {
    from: 7.56,
    to: 8.26,
    eyebrow: '5 · Display',
    title: 'Steady steps\nbecome time.',
    tour: 'The gears count the steps: seconds, minutes, hours.',
    body: 'The gears count the steps: 18,000 an hour. Minutes ride the centre wheel; seconds, the fourth wheel.',
    readout: 'time',
  },
  {
    from: 9.08,
    to: 99,
    // The ending lets the reassembled watch speak for itself: just the next steps.
    eyebrow: '',
    title: '',
    readout: 'explore',
  },
];

export const COPY: readonly CopyBeat[] = STORY_COPY.map(c => ({ ...c, from: c.from + INTRO, to: c.to + INTRO }));

export function copyAt(p: number): CopyBeat | null {
  return COPY.find(c => p >= c.from && p < c.to) ?? null;
}

/** 0..1 visibility of a copy beat, fading in and out near its edges. */
export function copyOpacity(beat: CopyBeat, p: number): number {
  const fade = 0.07;
  const inT = beat.from < 0 ? 1 : (p - beat.from) / fade;
  const outT = beat.to > P_END ? 1 : (beat.to - p) / fade;
  return Math.max(0, Math.min(1, inT, outT));
}
