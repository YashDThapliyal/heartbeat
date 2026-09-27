/**
 * Keyframe tracks sampled by scroll progress. Each segment eases in and out,
 * so the story settles at every key and holds wherever two keys repeat a value.
 */
import { smootherstep } from '../movement/simulation';

export type Ease = 'smooth' | 'linear' | 'in' | 'out';
export type Key<T> = readonly [at: number, value: T, ease?: Ease];
export type Vec3Tuple = readonly [number, number, number];

function eased(t: number, ease: Ease = 'smooth'): number {
  if (ease === 'linear') return t;
  if (ease === 'in') return t * t;
  if (ease === 'out') return 1 - (1 - t) * (1 - t);
  return smootherstep(t);
}

/** Finds the segment containing p. Returns [index, eased local t]. */
function locate<T>(keys: readonly Key<T>[], p: number): [number, number] {
  if (p <= keys[0][0]) return [0, 0];
  const last = keys.length - 1;
  if (p >= keys[last][0]) return [Math.max(0, last - 1), 1];
  let i = 0;
  while (i < last - 1 && p > keys[i + 1][0]) i++;
  const [a] = keys[i];
  const [b, , ease] = keys[i + 1];
  return [i, eased((p - a) / (b - a), ease)];
}

export function scalarTrack(keys: readonly Key<number>[]): (p: number) => number {
  if (keys.length === 1) return () => keys[0][1];
  return p => {
    const [i, t] = locate(keys, p);
    return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * t;
  };
}

/** Interpolates in log space: right for speeds that span orders of magnitude. */
export function logTrack(keys: readonly Key<number>[]): (p: number) => number {
  const logged = scalarTrack(keys.map(([at, v, e]) => [at, Math.log(v), e] as Key<number>));
  return p => Math.exp(logged(p));
}

export function vecTrack(keys: readonly Key<Vec3Tuple>[]): (p: number, out: number[]) => void {
  return (p, out) => {
    if (keys.length === 1) {
      out[0] = keys[0][1][0];
      out[1] = keys[0][1][1];
      out[2] = keys[0][1][2];
      return;
    }
    const [i, t] = locate(keys, p);
    const a = keys[i][1];
    const b = keys[i + 1][1];
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
  };
}

/** Rise between a and b, hold, fall between c and d. */
export function pulse(a: number, b: number, c: number, d: number, peak = 1): (p: number) => number {
  return scalarTrack([
    [a, 0],
    [b, peak],
    [c, peak],
    [d, 0],
  ]);
}

/**
 * Staggered local progress for one part inside a shared transition.
 * `order` in [0,1] picks when the part moves; `spread` is how much of the
 * transition the stagger may use.
 */
export function stagger(global: number, order: number, spread = 0.55): number {
  const start = order * spread;
  const span = 1 - spread;
  return smootherstep((global - start) / span);
}
