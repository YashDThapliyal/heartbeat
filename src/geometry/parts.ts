/**
 * Small turned and cut parts: screws, jewel settings, hands and the case.
 * Lathe profiles are given as (radius, z) pairs and revolved about the Z axis.
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;

/** Revolve a (radius, z) profile about the Z axis. */
export function turned(profile: readonly (readonly [number, number])[], segments = 64): THREE.BufferGeometry {
  const points = profile.map(([r, z]) => new THREE.Vector2(r, z));
  const geometry = new THREE.LatheGeometry(points, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/** Domed, polished screw head (the slot is a separate dark mesh). */
export function screwHead(radius: number, height: number): THREE.BufferGeometry {
  const shoulder = height * 0.35;
  const profile: [number, number][] = [
    [0.001, 0],
    [radius, 0],
  ];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    profile.push([Math.max(0.001, radius * Math.cos(a)), shoulder + (height - shoulder) * Math.sin(a)]);
  }
  return turned(profile, 32);
}

/** Gold chaton (jewel setting): a short tube with a polished chamfer. */
export function chaton(outer: number, inner: number, height: number): THREE.BufferGeometry {
  return turned(
    [
      [inner, height],
      [outer * 0.86, height],
      [outer, height * 0.7],
      [outer, 0],
      [inner, 0],
      [inner, height],
    ],
    32,
  );
}

/** Ruby with a concave oil-sink: a torus-like ring with a flat top. */
export function jewelStone(radius: number, hole: number, height: number): THREE.BufferGeometry {
  return turned(
    [
      [hole, height * 0.4],
      [hole * 2.2, height],
      [radius * 0.85, height],
      [radius, height * 0.6],
      [radius, 0],
      [hole, 0],
      [hole, height * 0.4],
    ],
    32,
  );
}

/**
 * Faceted dauphine hand: a raised central ridge splits the hand into two
 * flat-shaded facets that catch light differently.
 */
export function dauphineHand(length: number, width: number, tail: number, ridge: number): THREE.BufferGeometry {
  const tip = new THREE.Vector3(0, length, 0);
  const left = new THREE.Vector3(-width, length * 0.08, 0);
  const right = new THREE.Vector3(width, length * 0.08, 0);
  const back = new THREE.Vector3(0, -tail, 0);
  const ridgeTop = new THREE.Vector3(0, length * 0.08, ridge);
  const ridgeTip = new THREE.Vector3(0, length * 0.96, ridge * 0.25);
  const ridgeBack = new THREE.Vector3(0, -tail * 0.85, ridge * 0.4);
  const tris: THREE.Vector3[][] = [
    [left, ridgeTop, ridgeTip],
    [left, ridgeTip, tip],
    [ridgeTop, right, ridgeTip],
    [ridgeTip, right, tip],
    [back, ridgeTop, left],
    [back, ridgeBack, ridgeTop],
    [ridgeBack, right, ridgeTop],
    [back, right, ridgeBack],
    // Underside
    [left, tip, right],
    [left, right, back],
  ];
  const positions: number[] = [];
  for (const t of tris) for (const v of t) positions.push(v.x, v.y, v.z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Thin needle hand with a round counterweight. */
export function needleHand(length: number, width: number, tail: number, counterRadius: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width, 0);
  shape.lineTo(-width * 0.35, length);
  shape.lineTo(width * 0.35, length);
  shape.lineTo(width, 0);
  shape.lineTo(width * 0.8, -tail + counterRadius);
  shape.absarc(0, -tail, counterRadius, Math.PI / 2 - 0.3, Math.PI / 2 + 0.3 + TAU - 0.6, true);
  shape.lineTo(-width, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false, curveSegments: 16 });
  return geometry;
}

export interface CaseProfiles {
  middle: THREE.BufferGeometry;
  bezel: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  crystal: THREE.BufferGeometry;
  crystalSeat: THREE.BufferGeometry;
}

export function caseProfiles(): CaseProfiles {
  const middle = turned(
    [
      [2.3, 0.78],
      [2.5, 0.78],
      [2.6, 0.7],
      [2.64, 0.52],
      [2.645, 0.1],
      [2.63, -0.18],
      [2.58, -0.32],
      [2.48, -0.4],
      [2.3, -0.4],
      [2.3, 0.78],
    ],
    160,
  );
  const bezel = turned(
    [
      [2.31, 0.97],
      [2.37, 1.02],
      [2.47, 1.0],
      [2.56, 0.93],
      [2.6, 0.84],
      [2.58, 0.78],
      [2.31, 0.78],
      [2.31, 0.97],
    ],
    160,
  );
  const back = turned(
    [
      [0.001, -0.56],
      [1.6, -0.555],
      [2.2, -0.53],
      [2.42, -0.47],
      [2.5, -0.41],
      [2.3, -0.41],
      [0.001, -0.41],
    ],
    128,
  );
  const crystal = turned(
    [
      [0.001, 1.07],
      [1.2, 1.06],
      [2.0, 1.045],
      [2.31, 1.02],
      [2.31, 0.98],
      [0.001, 1.01],
    ],
    128,
  );
  const crystalSeat = turned(
    [
      [2.29, 0.82],
      [2.33, 0.82],
      [2.33, 0.98],
      [2.29, 0.98],
      [2.29, 0.82],
    ],
    128,
  );
  return { middle, bezel, back, crystal, crystalSeat };
}

/** Curved lug: a side profile extruded across its width. */
export function lugGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(1.9, 0.62);
  s.bezierCurveTo(2.6, 0.66, 3.1, 0.5, 3.36, 0.08);
  s.lineTo(3.3, -0.12);
  s.bezierCurveTo(3.0, 0.06, 2.6, -0.08, 2.2, -0.3);
  s.lineTo(1.9, -0.3);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.05,
    bevelSegments: 5,
    curveSegments: 32,
    steps: 6,
  });
  // Shape (sx, sy) with extrusion sz becomes world (x, y, z) = (sz, sx, sy).
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  g.translate(-0.17, 0, 0);
  // Taper toward the tip so the lug flows out of the case instead of reading as a block.
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - 1.9) / 1.46));
    pos.setX(i, pos.getX(i) * (1 - 0.32 * t * t));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Leather strap swept along a curve that bends back under the wrist. */
export function strapGeometry(side: 1 | -1): THREE.ExtrudeGeometry {
  // With this path the Frenet normal runs along X, so shape X is the strap's width.
  const halfW = 0.9;
  const halfT = 0.075;
  const r = 0.05;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfT);
  shape.lineTo(halfW - r, -halfT);
  shape.quadraticCurveTo(halfW, -halfT, halfW, -halfT + r);
  shape.lineTo(halfW, halfT - r);
  shape.quadraticCurveTo(halfW, halfT, halfW - r, halfT);
  shape.lineTo(-halfW + r, halfT);
  shape.quadraticCurveTo(-halfW, halfT, -halfW, halfT - r);
  shape.lineTo(-halfW, -halfT + r);
  shape.quadraticCurveTo(-halfW, -halfT, -halfW + r, -halfT);
  const path = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 3.02 * side, 0.0),
      new THREE.Vector3(0, 3.7 * side, -0.25),
      new THREE.Vector3(0, 4.35 * side, -0.95),
      new THREE.Vector3(0, 4.75 * side, -1.95),
      new THREE.Vector3(0, 4.85 * side, -3.1),
    ],
    false,
    'centripetal',
  );
  return new THREE.ExtrudeGeometry(shape, { steps: 60, bevelEnabled: false, extrudePath: path });
}

/**
 * Planar UVs normalised to a disc of the given radius (centre → 0.5, 0.5),
 * so concentric finishes (snailing, sunburst) centre on the part.
 */
export function planarUV<T extends THREE.BufferGeometry>(geometry: T, radius: number): T {
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / (radius * 2) + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / (radius * 2) + 0.5;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}
