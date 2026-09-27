/**
 * A flat spiral spring rendered as a thin rectangular ribbon (inner wall, outer
 * wall, top and bottom), so it reads correctly from above and from the side.
 * Positions are rewritten in place when the spring breathes or winds.
 */
import * as THREE from 'three';

export type SpiralFn = (u: number) => number;

export interface SpiralRibbonOptions {
  samples: number;
  /** Radial thickness of the strip (plan view). */
  width: number;
  /** Height of the strip along Z. */
  height: number;
}

const FACES = 4;
const VERTS_PER_SAMPLE = FACES * 2;

export class SpiralRibbon {
  readonly geometry: THREE.BufferGeometry;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly o: SpiralRibbonOptions;

  constructor(options: SpiralRibbonOptions) {
    this.o = options;
    const n = options.samples + 1;
    this.positions = new Float32Array(n * VERTS_PER_SAMPLE * 3);
    this.normals = new Float32Array(n * VERTS_PER_SAMPLE * 3);
    const index: number[] = [];
    for (let i = 0; i < options.samples; i++) {
      for (let f = 0; f < FACES; f++) {
        const a = i * VERTS_PER_SAMPLE + f * 2;
        const b = a + VERTS_PER_SAMPLE;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    const normal = new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', position);
    this.geometry.setAttribute('normal', normal);
    this.geometry.setIndex(index);
  }

  /** Rebuild along r(u), θ(u) for u ∈ [0, 1] (inner end → outer end). */
  update(radius: SpiralFn, angle: SpiralFn): void {
    const { samples, width, height } = this.o;
    const p = this.positions;
    const nrm = this.normals;
    const half = width / 2;
    let maxR = 0;
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const r = radius(u);
      const a = angle(u);
      const cx = Math.cos(a) * r;
      const cy = Math.sin(a) * r;
      // Tangent from a small step, in-plane normal perpendicular to it.
      const du = 1 / samples;
      const u2 = Math.min(1, u + du);
      const u1 = Math.max(0, u - du);
      const tx = Math.cos(angle(u2)) * radius(u2) - Math.cos(angle(u1)) * radius(u1);
      const ty = Math.sin(angle(u2)) * radius(u2) - Math.sin(angle(u1)) * radius(u1);
      const tl = Math.hypot(tx, ty) || 1;
      let nx = ty / tl;
      let ny = -tx / tl;
      if (nx * cx + ny * cy < 0) {
        nx = -nx;
        ny = -ny;
      }
      const ox = cx + nx * half;
      const oy = cy + ny * half;
      const ix = cx - nx * half;
      const iy = cy - ny * half;
      // [outer wall, inner wall, top, bottom] × [z0, z1]
      const verts = [
        [ox, oy, 0, nx, ny, 0], [ox, oy, height, nx, ny, 0],
        [ix, iy, height, -nx, -ny, 0], [ix, iy, 0, -nx, -ny, 0],
        [ox, oy, height, 0, 0, 1], [ix, iy, height, 0, 0, 1],
        [ix, iy, 0, 0, 0, -1], [ox, oy, 0, 0, 0, -1],
      ];
      const base = i * VERTS_PER_SAMPLE * 3;
      for (let v = 0; v < VERTS_PER_SAMPLE; v++) {
        const d = verts[v];
        p[base + v * 3] = d[0];
        p[base + v * 3 + 1] = d[1];
        p[base + v * 3 + 2] = d[2];
        nrm[base + v * 3] = d[3];
        nrm[base + v * 3 + 1] = d[4];
        nrm[base + v * 3 + 2] = d[5];
      }
      if (r > maxR) maxR = r;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, height / 2), maxR + width + height);
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
