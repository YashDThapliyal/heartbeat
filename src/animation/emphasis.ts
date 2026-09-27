/**
 * How bright, how glowing and how visible each part should be right now.
 * Kept pure so the rules are easy to read and to test.
 */
import type { Story } from './story';
import type { PartId } from '../movement/catalog';
import { mix } from '../movement/simulation';
import { WOUND } from './interaction';

export type FocusGroup = 'winding' | 'train' | 'escapement' | 'balance' | 'display' | 'structure';

export type Behaviour = 'bridge' | 'barrelLid' | 'windingLift' | 'balanceLift' | 'dial' | 'exterior' | 'none';

export interface PartTraits {
  id: PartId;
  groups: readonly FocusGroup[];
  /** Position in the energy chain: 0 barrel … 4 escape wheel. */
  trainIndex?: number;
  behaviour: Behaviour;
}

export interface Emphasis {
  brightness: number;
  glow: number;
  opacity: number;
  /** Extra movement along the part's local Z (lift away, sink back). */
  lift: number;
}

const DIM = 0.32;

export function emphasisFor(t: PartTraits, story: Story, out: Emphasis): Emphasis {
  const f = story.frame;
  const has = (g: FocusGroup) => t.groups.includes(g);
  let brightness = 1;
  let glow = 0;
  let opacity = 1;
  let lift = 0;

  if (story.explore) {
    const focus = story.selected ?? story.hovered;
    if (focus) {
      if (focus === t.id) glow = story.selected === t.id ? 0.22 : 0.12;
      else brightness = story.selected ? 0.3 : 0.62;
    }
    if (t.behaviour === 'dial') opacity = 0.07;
    out.brightness = brightness;
    out.glow = glow;
    out.opacity = opacity;
    out.lift = story.selected === t.id ? 0.12 : 0;
    return out;
  }

  // Anatomy chapter: hovering names a part and quiets the rest.
  if (f.hoverable && story.hovered) {
    if (story.hovered === t.id) glow = 0.14;
    else brightness *= 0.6;
  }

  if (f.focus.winding > 0 && !has('winding')) brightness *= mix(1, DIM, f.focus.winding);
  // "Wind here": the crown pulses warmly until the mainspring is fully wound.
  if (f.handsOn === 'wind' && t.id === 'crown' && story.interact.wind < WOUND) {
    glow += 0.2 + 0.12 * Math.sin(story.elapsed * 4);
  }

  if (f.focus.train > 0) {
    if (t.trainIndex !== undefined) {
      const d = f.energy - t.trainIndex;
      const reached = d > -0.5;
      const active = Math.max(0, 1 - Math.abs(d) * 1.4);
      if (!reached) brightness *= mix(1, 0.45, f.focus.train);
      brightness *= 1 + 0.3 * active * f.focus.train;
      glow += f.focus.train * active * 0.22;
    } else if (!has('winding')) {
      brightness *= mix(1, DIM, f.focus.train);
    }
  }

  if (f.isolate > 0 && !has('escapement') && !has('balance')) {
    brightness *= mix(1, 0.22, f.isolate);
    lift -= 0.35 * f.isolate;
  }
  if (f.focus.balance > 0 && !has('balance')) brightness *= mix(1, 0.55, f.focus.balance);
  if (f.focus.display > 0) {
    if (has('display')) brightness *= 1 + 0.2 * f.focus.display;
    else brightness *= mix(1, 0.62, f.focus.display);
  }

  switch (t.behaviour) {
    case 'bridge':
      opacity *= 1 - f.bridgesAway;
      lift += 1.3 * f.bridgesAway;
      break;
    case 'barrelLid':
      opacity *= 1 - f.barrelOpen;
      lift += 0.08 * f.barrelOpen;
      break;
    case 'windingLift':
      // The winding wheels rise while the barrel is open, so the spring is visible.
      lift += 0.5 * f.barrelOpen;
      break;
    case 'balanceLift':
      lift += 0.42 * f.balanceLift;
      break;
    case 'dial':
      opacity *= mix(1, 0.24, f.dialGhost);
      break;
    default:
      break;
  }

  out.brightness = brightness;
  out.glow = glow;
  out.opacity = opacity;
  out.lift = lift;
  return out;
}
