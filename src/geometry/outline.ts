/**
 * 2D signed-distance modelling for plates, bridges and the pallet fork.
 * Shapes are built by smoothly blending circles and capsules (which gives the
 * soft fillets of a hand-finished bridge), then traced with marching squares.
 */
import * as THREE from 'three';

export type Sdf = (x: number, y: number) => number;
export type P2 = readonly [number, number];

export const circle = (c: P2, r: number): Sdf => (x, y) => Math.hypot(x - c[0], y - c[1]) - r;

/** Capsule from a (radius ra) to b (radius rb). */
export function capsule(a: P2, b: P2, ra: number, rb = ra): Sdf {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const h = Math.hypot(dx, dy);
  const ux = dx / h;
  const uy = dy / h;
  const k = (ra - rb) / h;
  const m = Math.sqrt(Math.max(0, 1 - k * k));
  return (x, y) => {
    // Into the segment frame: along = v, across = |u|.
    const px = x - a[0];
    const py = y - a[1];
    const along = px * ux + py * uy;
    const across = Math.abs(-px * uy + py * ux);
    const d = -k * across + m * along;
    if (d < 0) return Math.hypot(across, along) - ra;
    if (d > m * h) return Math.hypot(across, along - h) - rb;
    return across * m + along * k - ra;
  };
}

export function box(c: P2, halfW: number, halfH: number, angle = 0, round = 0): Sdf {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return (x, y) => {
    const px = (x - c[0]) * cos - (y - c[1]) * sin;
    const py = (x - c[0]) * sin + (y - c[1]) * cos;
    const qx = Math.abs(px) - halfW + round;
    const qy = Math.abs(py) - halfH + round;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round;
  };
}

function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

export const union = (k: number, ...parts: Sdf[]): Sdf => (x, y) => {
  let d = parts[0](x, y);
  for (let i = 1; i < parts.length; i++) d = smin(d, parts[i](x, y), k);
  return d;
};

export const subtract = (base: Sdf, ...cuts: Sdf[]): Sdf => (x, y) => {
  let d = base(x, y);
  for (const cut of cuts) d = Math.max(d, -cut(x, y));
  return d;
};

export const intersect = (a: Sdf, b: Sdf): Sdf => (x, y) => Math.max(a(x, y), b(x, y));

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type Loop = P2[];

/** Marching squares → closed loops of points (unordered orientation). */
function traceLoops(sdf: Sdf, b: Bounds, cell: number): Loop[] {
  const nx = Math.ceil((b.maxX - b.minX) / cell) + 1;
  const ny = Math.ceil((b.maxY - b.minY) / cell) + 1;
  const values = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      // Pad the border as "outside" so every loop closes.
      const edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1;
      values[j * nx + i] = edge ? 1 : sdf(b.minX + i * cell, b.minY + j * cell);
    }
  }
  const v = (i: number, j: number) => values[j * nx + i];
  // Edge ids: horizontal edges (i,j)-(i+1,j) and vertical edges (i,j)-(i,j+1).
  const hId = (i: number, j: number) => (j * nx + i) * 2;
  const vId = (i: number, j: number) => (j * nx + i) * 2 + 1;
  const points = new Map<number, P2>();
  const lerp = (a: number, bv: number) => a / (a - bv);
  const pointOn = (id: number): P2 => {
    const cached = points.get(id);
    if (cached) return cached;
    const base = id >> 1;
    const i = base % nx;
    const j = Math.floor(base / nx);
    let p: P2;
    if ((id & 1) === 0) {
      const t = lerp(v(i, j), v(i + 1, j));
      p = [b.minX + (i + t) * cell, b.minY + j * cell];
    } else {
      const t = lerp(v(i, j), v(i, j + 1));
      p = [b.minX + i * cell, b.minY + (j + t) * cell];
    }
    points.set(id, p);
    return p;
  };

  const links = new Map<number, number[]>();
  const link = (a: number, c: number) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(c);
    (links.get(c) ?? links.set(c, []).get(c)!).push(a);
  };

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = v(i, j) < 0 ? 1 : 0;
      const bb = v(i + 1, j) < 0 ? 2 : 0;
      const c = v(i + 1, j + 1) < 0 ? 4 : 0;
      const d = v(i, j + 1) < 0 ? 8 : 0;
      const code = a | bb | c | d;
      if (code === 0 || code === 15) continue;
      const bottom = hId(i, j);
      const right = vId(i + 1, j);
      const top = hId(i, j + 1);
      const left = vId(i, j);
      const centreInside = (v(i, j) + v(i + 1, j) + v(i + 1, j + 1) + v(i, j + 1)) / 4 < 0;
      switch (code) {
        case 1: case 14: link(left, bottom); break;
        case 2: case 13: link(bottom, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(right, top); break;
        case 6: case 9: link(bottom, top); break;
        case 7: case 8: link(left, top); break;
        case 5:
          if (centreInside) { link(left, top); link(bottom, right); } else { link(left, bottom); link(right, top); }
          break;
        case 10:
          if (centreInside) { link(left, bottom); link(right, top); } else { link(left, top); link(bottom, right); }
          break;
      }
    }
  }

  const loops: Loop[] = [];
  const visited = new Set<number>();
  for (const start of links.keys()) {
    if (visited.has(start)) continue;
    const loop: P2[] = [];
    let prev = -1;
    let current = start;
    while (!visited.has(current)) {
      visited.add(current);
      loop.push(pointOn(current));
      const next = links.get(current)!.find(n => n !== prev && !visited.has(n));
      if (next === undefined) break;
      prev = current;
      current = next;
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

function signedArea(loop: Loop): number {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % loop.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function contains(loop: Loop, p: P2): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i];
    const [xj, yj] = loop[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Douglas–Peucker simplification for closed loops. */
function simplify(loop: Loop, epsilon: number): Loop {
  if (loop.length < 16) return loop;
  const keep = new Uint8Array(loop.length);
  const stack: [number, number][] = [[0, Math.floor(loop.length / 2)], [Math.floor(loop.length / 2), loop.length - 1]];
  keep[0] = keep[loop.length - 1] = keep[Math.floor(loop.length / 2)] = 1;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = loop[s];
    const [bx, by] = loop[e];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1;
    let worstD = 0;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((bx - ax) * (ay - loop[i][1]) - (ax - loop[i][0]) * (by - ay)) / len;
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0 && worstD > epsilon) {
      keep[worst] = 1;
      stack.push([s, worst], [worst, e]);
    }
  }
  return loop.filter((_, i) => keep[i]);
}

const toVectors = (loop: Loop) => loop.map(([x, y]) => new THREE.Vector2(x, y));

export function traceShapes(sdf: Sdf, bounds: Bounds, cell = 0.008): THREE.Shape[] {
  const loops = traceLoops(sdf, bounds, cell).map(l => simplify(l, cell * 0.12));
  const depth = loops.map(l => loops.filter(o => o !== l && contains(o, l[0])).length);
  const outers = loops.filter((_, i) => depth[i] % 2 === 0);
  const holes = loops.filter((_, i) => depth[i] % 2 === 1);
  return outers.map(outer => {
    const ccw = signedArea(outer) > 0 ? outer : [...outer].reverse();
    const shape = new THREE.Shape(toVectors(ccw));
    for (const hole of holes) {
      if (!contains(outer, hole[0])) continue;
      const cw = signedArea(hole) < 0 ? hole : [...hole].reverse();
      shape.holes.push(new THREE.Path(toVectors(cw)));
    }
    return shape;
  });
}

export interface SlabOptions {
  thickness: number;
  bevel: number;
  cell?: number;
  bounds: Bounds;
}

/**
 * Extruded slab from an SDF. Group 0 = flat faces, group 1 = sides and bevel,
 * so the bevel can carry a polished "anglage" material.
 */
export function createSlab(sdf: Sdf, o: SlabOptions): THREE.BufferGeometry {
  const shapes = traceShapes(sdf, o.bounds, o.cell);
  const depth = Math.max(0.001, o.thickness - o.bevel * 2);
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: o.bevel > 0,
    bevelThickness: o.bevel,
    bevelSize: o.bevel,
    bevelSegments: 2,
    curveSegments: 4,
    steps: 1,
  });
  geometry.translate(0, 0, o.bevel);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
