/**
 * Procedural surface finishes, generated once into canvases (no image assets).
 * Height fields are converted into tangent-space normal maps so the traditional
 * decorations catch the studio lighting the way real finishing does.
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;

type HeightFn = (x: number, y: number) => number;

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function sampleHeights(size: number, height: HeightFn): Float32Array {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = height(x / size, y / size);
  return h;
}

function normalMap(size: number, height: HeightFn | Float32Array, strength: number, wrap = true): THREE.CanvasTexture {
  const h = height instanceof Float32Array ? height : sampleHeights(size, height);
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) => {
    const xx = wrap ? (x + size) % size : Math.min(size - 1, Math.max(0, x));
    const yy = wrap ? (y + size) % size : Math.min(size - 1, Math.max(0, y));
    return h[yy * size + xx];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Deterministic pseudo-random numbers so every load looks identical. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Periodic 1D noise from integer-frequency sines (tiles across [0, 1)), tabulated. */
function periodicNoise(seed: number, terms: number, minFreq: number, maxFreq: number): (t: number) => number {
  const r = rng(seed);
  const waves = Array.from({ length: terms }, () => ({
    f: Math.round(minFreq + r() * (maxFreq - minFreq)),
    p: r() * TAU,
    a: 0.4 + r() * 0.6,
  }));
  const norm = waves.reduce((s, w) => s + w.a, 0);
  const n = 16384;
  const table = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    table[i] = waves.reduce((s, w) => s + w.a * Math.sin(w.f * TAU * t + w.p), 0) / norm;
  }
  return t => {
    const x = (((t % 1) + 1) % 1) * n;
    const i = Math.floor(x);
    return table[i] + (table[i + 1] - table[i]) * (x - i);
  };
}

/** Côtes de Genève: parallel ground stripes, each a shallow cylindrical band. */
export function cotesDeGeneve(): THREE.CanvasTexture {
  const stripes = 5;
  const grain = periodicNoise(11, 24, 180, 520);
  const texture = normalMap(
    512,
    (x, y) => {
      const v = (x * stripes) % 1;
      const band = Math.pow(Math.sin(Math.PI * v), 0.7);
      return band * 0.6 + grain(y + v * 0.13) * 0.02;
    },
    14,
  );
  return texture;
}

/** Perlage: overlapping circular graining laid down row by row. */
export function perlage(): THREE.CanvasTexture {
  const size = 512;
  const cells = 7;
  const step = 1 / cells;
  const radius = step * 0.78;
  const ripple = periodicNoise(5, 12, 30, 90);
  const heights = new Float32Array(size * size);
  const rPx = Math.ceil(radius * size);
  // Paint circles in order; later ones overlap earlier ones, as on the bench.
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const cx = ((i + (j % 2) * 0.5) * step) * size;
      const cy = j * step * size;
      for (let py = -rPx; py <= rPx; py++) {
        for (let px = -rPx; px <= rPx; px++) {
          const d = Math.hypot(px, py) / (radius * size);
          if (d >= 1) continue;
          const x = (Math.round(cx + px) + size) % size;
          const y = (Math.round(cy + py) + size) % size;
          const a = Math.atan2(py, px) / TAU;
          heights[y * size + x] = ripple(a + d * 0.35) * 0.5 * (1 - d * 0.6) + (1 - d) * 0.25;
        }
      }
    }
  }
  return normalMap(size, heights, 9);
}

/** Sunburst: fine radial brushing that throws a rotating fan of light. */
export function sunburst(): THREE.CanvasTexture {
  const brush = periodicNoise(7, 36, 160, 720);
  return normalMap(
    1024,
    (x, y) => {
      const r = Math.hypot(x - 0.5, y - 0.5);
      const a = Math.atan2(y - 0.5, x - 0.5) / TAU;
      // Fade the brushing out at the centre, where radial lines converge.
      return brush(a) * 0.5 * Math.min(1, r * 8);
    },
    5,
    false,
  );
}

/** Circular graining (snailing) centred on the texture. */
export function snailing(): THREE.CanvasTexture {
  const brush = periodicNoise(3, 30, 120, 480);
  return normalMap(
    1024,
    (x, y) => {
      const r = Math.hypot(x - 0.5, y - 0.5);
      const a = Math.atan2(y - 0.5, x - 0.5) / TAU;
      return brush(r * 1.4 + a * 0.004) * 0.5;
    },
    14,
    false,
  );
}

/** Fine leather grain. */
export function leather(): THREE.CanvasTexture {
  const r = rng(19);
  const size = 256;
  const cells = Array.from({ length: 220 }, () => [r(), r(), 0.02 + r() * 0.04] as const);
  return normalMap(
    size,
    (x, y) => {
      let h = 0;
      for (const [cx, cy, rad] of cells) {
        let dx = Math.abs(x - cx);
        let dy = Math.abs(y - cy);
        if (dx > 0.5) dx = 1 - dx;
        if (dy > 0.5) dy = 1 - dy;
        const d = Math.hypot(dx, dy) / rad;
        if (d < 1) h = Math.max(h, 1 - d * d);
      }
      return h * 0.4;
    },
    3,
  );
}

export interface DialPrintOptions {
  subSecondsCentre: readonly [number, number];
  subSecondsRadius: number;
  dialRadius: number;
}

/**
 * Printed dial layer (white on transparent): chapter ring, sub-seconds track
 * and signature. Drawn at 2048 px so fine lines stay crisp in close-ups.
 */
export function dialPrint(o: DialPrintOptions): THREE.CanvasTexture {
  const size = 2048;
  const [c, ctx] = canvas(size);
  const scale = size / (o.dialRadius * 2);
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, -scale);
  const ink = 'rgba(232, 230, 222, 0.92)';
  const faint = 'rgba(232, 230, 222, 0.42)';

  // Railway minute track near the edge.
  const outer = o.dialRadius - 0.1;
  const inner = outer - 0.09;
  ctx.lineWidth = 0.006;
  ctx.strokeStyle = faint;
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, inner, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const major = i % 5 === 0;
    ctx.strokeStyle = major ? ink : faint;
    ctx.lineWidth = major ? 0.014 : 0.007;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * inner, Math.cos(a) * inner);
    ctx.lineTo(Math.sin(a) * (outer + (major ? 0.02 : 0)), Math.cos(a) * (outer + (major ? 0.02 : 0)));
    ctx.stroke();
  }

  // Sub-seconds: concentric track with 5-second markers.
  const [sx, sy] = o.subSecondsCentre;
  const sr = o.subSecondsRadius;
  ctx.strokeStyle = faint;
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const major = i % 15 === 0;
    const mid = i % 5 === 0;
    ctx.strokeStyle = mid ? ink : faint;
    ctx.lineWidth = major ? 0.012 : mid ? 0.008 : 0.004;
    const r0 = sr - (major ? 0.1 : mid ? 0.07 : 0.04);
    ctx.beginPath();
    ctx.moveTo(sx + Math.sin(a) * r0, sy + Math.cos(a) * r0);
    ctx.lineTo(sx + Math.sin(a) * sr, sy + Math.cos(a) * sr);
    ctx.stroke();
  }

  // Signature (drawn upright: flip the Y scale locally).
  const text = (s: string, y: number, px: number, color: string, spacing: number) => {
    ctx.save();
    ctx.scale(1, -1);
    ctx.fillStyle = color;
    ctx.font = `500 ${px}px "Inter Variable", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${spacing}px`;
    ctx.fillText(s, 0, -y);
    ctx.restore();
  };
  text('HEARTBEAT', 1.02, 0.14, ink, 0.05);
  text('01', 0.82, 0.1, faint, 0.03);
  text('SEVENTEEN JEWELS', 0.52, 0.065, faint, 0.03);
  text('HAND-WOUND', 0.41, 0.065, faint, 0.03);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Anisotropy direction field for three.js (RG = direction in UV space, B = strength).
 * 'circular' brushing (tangential) gives the sweeping arcs of circular graining;
 * 'radial' brushing gives a sunburst dial its rotating fan of light.
 * Expects normalised planar UVs (centre at 0.5, 0.5).
 */
export function brushDirection(kind: 'circular' | 'radial'): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const a = Math.atan2(dy, dx) + (kind === 'circular' ? Math.PI / 2 : 0);
      const r = Math.hypot(dx, dy);
      const i = (y * size + x) * 4;
      data[i] = (Math.cos(a) * 0.5 + 0.5) * 255;
      data[i + 1] = (Math.sin(a) * 0.5 + 0.5) * 255;
      // Fade out at the very centre, where the direction is undefined.
      data[i + 2] = Math.min(1, r * 14) * 255;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Micro roughness: soft smudges and sparse hairline scratches, so no surface is
 * perfectly uniform. Green channel (three.js reads roughness from G), centred near 1
 * so it modulates rather than replaces each material's roughness.
 */
export function microRoughness(): THREE.CanvasTexture {
  const size = 512;
  const r = rng(29);
  const smudge = periodicNoise(13, 10, 2, 9);
  const smudge2 = periodicNoise(17, 10, 2, 9);
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Mostly 0.65–0.9, so the material's own roughness is the upper bound.
      const n = (smudge(x / size + smudge2(y / size) * 0.2) + smudge2(y / size + (x / size) * 0.3)) * 0.25 + 0.5;
      const v = 0.62 + 0.3 * n;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v * 255));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Hairline scratches read as slightly rougher lines that catch light.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI;
    const len = 20 + r() * 110;
    ctx.strokeStyle = `rgba(70,70,70,${0.3 + r() * 0.4})`;
    ctx.lineWidth = 0.6 + r() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}
