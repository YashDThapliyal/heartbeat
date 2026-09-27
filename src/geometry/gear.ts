/**
 * Procedural wheels, pinions and the escape wheel.
 * Tooth k is always centred on angle 2πk/z so simulation phases line up with geometry.
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;

export interface WheelOptions {
  teeth: number;
  pitchRadius: number;
  thickness: number;
  spokes: number;
  /** Fraction of the angular pitch occupied by a tooth at the pitch circle. */
  toothWidth?: number;
  hubRadius?: number;
  holeRadius?: number;
  rimWidth?: number;
  bevel?: number;
  curveSegments?: number;
}

/** Horological (cycloid-like) tooth: radial flanks and an ogival, rounded addendum. */
function toothOutline(points: THREE.Vector2[], k: number, o: Required<WheelOptions>): void {
  const pitch = TAU / o.teeth;
  const module = (2 * o.pitchRadius) / o.teeth;
  const tip = o.pitchRadius + module * 1.25;
  const root = o.pitchRadius - module * 1.55;
  const half = (pitch * o.toothWidth) / 2;
  const centre = k * pitch;
  const push = (r: number, a: number) => points.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));

  // Root gap (rounded) leading into this tooth.
  const gapHalf = pitch / 2 - half;
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    const a = centre - pitch / 2 + gapHalf * (0.35 + 0.65 * t);
    push(root + module * 0.18 * Math.sin(t * Math.PI * 0.5) * (1 - t), a);
  }
  // Radial flank up to the pitch circle, then the ogive to the tip and down again.
  push(o.pitchRadius, centre - half);
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    push(o.pitchRadius + (tip - o.pitchRadius) * Math.sin((t * Math.PI) / 2), centre - half * (1 - t * 0.82) * Math.cos((t * Math.PI) / 2.6));
  }
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    push(o.pitchRadius + (tip - o.pitchRadius) * Math.sin((t * Math.PI) / 2), centre + half * (1 - t * 0.82) * Math.cos((t * Math.PI) / 2.6));
  }
  push(o.pitchRadius, centre + half);
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    const a = centre + half + gapHalf * 0.65 * t;
    push(root + module * 0.18 * Math.sin((1 - t) * Math.PI * 0.5) * t, a);
  }
}

function withDefaults(options: WheelOptions): Required<WheelOptions> {
  const module = (2 * options.pitchRadius) / options.teeth;
  return {
    toothWidth: options.toothWidth ?? 0.48,
    hubRadius: options.hubRadius ?? Math.max(0.05, options.pitchRadius * 0.2),
    holeRadius: options.holeRadius ?? 0.018,
    // Keep the rim clear of the tooth roots.
    rimWidth: options.rimWidth ?? Math.max(0.045, options.pitchRadius * 0.09 + module),
    bevel: options.bevel ?? 0.004,
    curveSegments: options.curveSegments ?? 24,
    teeth: options.teeth,
    pitchRadius: options.pitchRadius,
    thickness: options.thickness,
    spokes: options.spokes,
  };
}

/** Curved-cornered window between two spokes. */
function spokeWindow(a0: number, a1: number, rOuter: number, rInner: number, spokeHalf: number): THREE.Path {
  const path = new THREE.Path();
  const wo = spokeHalf / rOuter;
  const wi = (spokeHalf * 1.35) / rInner;
  const fillet = Math.min(0.05, (rOuter - rInner) * 0.18);
  const fo = fillet / rOuter;
  const fi = fillet / rInner;
  const pt = (r: number, a: number) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);

  const oStart = a0 + wo;
  const oEnd = a1 - wo;
  const iStart = a0 + wi;
  const iEnd = a1 - wi;

  const p0 = pt(rOuter, oStart + fo);
  path.moveTo(p0.x, p0.y);
  path.absarc(0, 0, rOuter, oStart + fo, oEnd - fo, false);
  let c = pt(rOuter, oEnd);
  let e = pt(rOuter - fillet, oEnd - fo * 0.2);
  path.quadraticCurveTo(c.x, c.y, e.x, e.y);
  e = pt(rInner + fillet, iEnd);
  path.lineTo(e.x, e.y);
  c = pt(rInner, iEnd);
  e = pt(rInner, iEnd - fi);
  path.quadraticCurveTo(c.x, c.y, e.x, e.y);
  path.absarc(0, 0, rInner, iEnd - fi, iStart + fi, true);
  c = pt(rInner, iStart);
  e = pt(rInner + fillet, iStart);
  path.quadraticCurveTo(c.x, c.y, e.x, e.y);
  e = pt(rOuter - fillet, oStart + fo * 0.2);
  path.lineTo(e.x, e.y);
  c = pt(rOuter, oStart);
  path.quadraticCurveTo(c.x, c.y, p0.x, p0.y);
  return path;
}

function addSpokesAndHole(shape: THREE.Shape, innerRim: number, o: Required<WheelOptions>, spokeHalf: number, phase = 0) {
  if (o.spokes > 0 && innerRim > o.hubRadius + 0.04) {
    for (let i = 0; i < o.spokes; i++) {
      const a0 = phase + (i / o.spokes) * TAU;
      const a1 = phase + ((i + 1) / o.spokes) * TAU;
      shape.holes.push(spokeWindow(a0, a1, innerRim, o.hubRadius, spokeHalf));
    }
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, o.holeRadius, 0, TAU, true);
  shape.holes.push(hole);
}

function extrude(shape: THREE.Shape, thickness: number, bevel: number, curveSegments: number): THREE.ExtrudeGeometry {
  const depth = Math.max(0.001, thickness - bevel * 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeBoundingSphere();
  return geometry;
}

export function createWheel(options: WheelOptions): THREE.ExtrudeGeometry {
  const o = withDefaults(options);
  const points: THREE.Vector2[] = [];
  for (let k = 0; k < o.teeth; k++) toothOutline(points, k, o);
  const shape = new THREE.Shape(points);
  const module = (2 * o.pitchRadius) / o.teeth;
  const innerRim = o.pitchRadius - module * 1.55 - o.rimWidth;
  addSpokesAndHole(shape, innerRim, o, Math.max(0.018, o.pitchRadius * 0.045), Math.PI / 2);
  return extrude(shape, o.thickness, o.bevel, o.curveSegments);
}

/** Pinion leaves: fewer, fatter teeth with deep gaps and rounded tips. */
export function createPinion(leaves: number, pitchRadius: number, length: number): THREE.ExtrudeGeometry {
  return createWheel({
    teeth: leaves,
    pitchRadius,
    thickness: length,
    spokes: 0,
    toothWidth: 0.42,
    holeRadius: 0.001,
    bevel: 0.002,
    curveSegments: 8,
  });
}

export interface EscapeWheelOptions {
  teeth: number;
  tipRadius: number;
  rootRadius: number;
  thickness: number;
  spokes: number;
}

/**
 * Swiss-lever club-tooth escape wheel, turning counter-clockwise.
 * Tooth k's locking corner sits exactly at angle 2πk/z; the club (impulse face)
 * trails behind it and the back of the tooth sweeps down in a concave curve.
 */
export function createEscapeWheel(o: EscapeWheelOptions): THREE.ExtrudeGeometry {
  const pitch = TAU / o.teeth;
  const DEG = Math.PI / 180;
  const shape = new THREE.Shape();
  const pt = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
  const club = 0.028;
  // Walk clockwise (decreasing angle) so each tooth's root arc leads into the next.
  for (let i = 0; i < o.teeth; i++) {
    const c = -i * pitch;
    const rootLead = pt(o.rootRadius, c + 2.4 * DEG);
    if (i === 0) shape.moveTo(...rootLead);
    else shape.lineTo(...rootLead);
    // Locking face, leaning slightly forward (draw).
    shape.lineTo(...pt(o.tipRadius, c));
    // Club: the impulse face falls away behind the locking corner.
    shape.lineTo(...pt(o.tipRadius - club * 0.25, c - 2.2 * DEG));
    shape.lineTo(...pt(o.tipRadius - club, c - 4.4 * DEG));
    // Concave back of the tooth down to the root circle.
    const ctrl = pt(o.rootRadius + (o.tipRadius - o.rootRadius) * 0.2, c - 6 * DEG);
    const end = pt(o.rootRadius, c - pitch * 0.62);
    shape.quadraticCurveTo(ctrl[0], ctrl[1], end[0], end[1]);
    shape.absarc(0, 0, o.rootRadius, c - pitch * 0.62, c - pitch + 2.4 * DEG, true);
  }
  shape.closePath();
  const rim = o.rootRadius - 0.045;
  const opts = withDefaults({
    teeth: o.teeth,
    pitchRadius: o.tipRadius,
    thickness: o.thickness,
    spokes: o.spokes,
    hubRadius: 0.07,
    holeRadius: 0.012,
  });
  addSpokesAndHole(shape, rim, opts, 0.016, Math.PI / 4);
  return extrude(shape, o.thickness, 0.003, 12);
}

/** Straight-knurled crown: a toothed disc extruded along its axis. */
export function createKnurledCylinder(radius: number, length: number, ridges: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i <= ridges * 2; i++) {
    const a = (i / (ridges * 2)) * TAU;
    const r = i % 2 === 0 ? radius : radius * 0.955;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return extrude(shape, length, 0.012, 4);
}
