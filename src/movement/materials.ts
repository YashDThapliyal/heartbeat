/**
 * Material library. Finishes differ the way they do on a real movement:
 * rhodium bridges with Côtes de Genève, perlage on the plate, gilt wheels,
 * polished steel pinions, blued screws and synthetic rubies.
 */
import * as THREE from 'three';
import { brushDirection, cotesDeGeneve, leather, microRoughness, perlage, sunburst } from './textures';

export interface MaterialLibrary {
  rhodium: THREE.MeshStandardMaterial;
  anglage: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  plateSide: THREE.MeshStandardMaterial;
  plateSink: THREE.MeshPhysicalMaterial;
  gilt: THREE.MeshStandardMaterial;
  /** Train wheels: circular graining (needs normalised planar UVs). */
  giltWheel: THREE.MeshPhysicalMaterial;
  /** Circular-grained steel: ratchet, crown wheel, barrel lid (normalised planar UVs). */
  grained: THREE.MeshPhysicalMaterial;
  giltPolished: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  escapeSteel: THREE.MeshStandardMaterial;
  blued: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  ruby: THREE.MeshPhysicalMaterial;
  gold: THREE.MeshStandardMaterial;
  balance: THREE.MeshStandardMaterial;
  hairspring: THREE.MeshStandardMaterial;
  mainspring: THREE.MeshStandardMaterial;
  dial: THREE.MeshStandardMaterial;
  subDial: THREE.MeshStandardMaterial;
  applied: THREE.MeshStandardMaterial;
  handSteel: THREE.MeshStandardMaterial;
  lume: THREE.MeshStandardMaterial;
  caseSteel: THREE.MeshStandardMaterial;
  caseBrushed: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  leather: THREE.MeshStandardMaterial;
  stitch: THREE.MeshStandardMaterial;
}

function metal(color: string, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, ...extra });
}

/** Physically based metal that supports anisotropic (brushed) highlights. */
function brushedMetal(color: string, roughness: number, extra: THREE.MeshPhysicalMaterialParameters = {}) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness, ...extra });
}

function tiled(texture: THREE.Texture, tile: number, rotation = 0): THREE.Texture {
  texture.repeat.set(1 / tile, 1 / tile);
  texture.rotation = rotation;
  return texture;
}

let library: MaterialLibrary | null = null;

export function getMaterials(): MaterialLibrary {
  if (library) return library;
  const cotes = tiled(cotesDeGeneve(), 1.3, 0.52);
  const pearl = tiled(perlage(), 0.44);
  const grain = tiled(leather(), 0.7);
  // Concentric finishes expect normalised planar UVs (see planarUV).
  const radial = sunburst();
  const circular = brushDirection('circular');
  const radialBrush = brushDirection('radial');
  // Smudges and hairline scratches: one copy in world units, one for normalised UVs.
  const micro = tiled(microRoughness(), 1.6);
  const microUnit = microRoughness();
  const v = (x: number) => new THREE.Vector2(x, x);

  library = {
    rhodium: metal('#c9cdd1', 0.22, { normalMap: cotes, normalScale: v(0.26), roughnessMap: micro }),
    anglage: metal('#eef0f3', 0.035),
    plate: metal('#a4a9ad', 0.42, { normalMap: pearl, normalScale: v(0.22), roughnessMap: micro }),
    plateSide: metal('#9ea2a5', 0.28),
    plateSink: brushedMetal('#8d9296', 0.34, { anisotropy: 0.75, anisotropyMap: circular, roughnessMap: microUnit }),
    gilt: metal('#e6bb6c', 0.24, { roughnessMap: micro }),
    giltWheel: brushedMetal('#e8bd6e', 0.32, { anisotropy: 0.8, anisotropyMap: circular, roughnessMap: microUnit }),
    grained: brushedMetal('#c3c7cb', 0.3, { anisotropy: 0.8, anisotropyMap: circular, roughnessMap: microUnit }),
    giltPolished: metal('#f0cf8f', 0.08),
    steel: metal('#cfd3d7', 0.14, { roughnessMap: micro }),
    escapeSteel: metal('#d7dbdf', 0.36, { roughnessMap: micro }),
    blued: metal('#2b4db3', 0.14, { envMapIntensity: 1.4 }),
    dark: new THREE.MeshStandardMaterial({ color: '#16181a', metalness: 0.6, roughness: 0.55 }),
    ruby: new THREE.MeshPhysicalMaterial({
      color: '#c0122f',
      metalness: 0,
      roughness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      ior: 1.76,
      specularIntensity: 1,
      emissive: '#4a0410',
      emissiveIntensity: 0.9,
    }),
    gold: metal('#e9ca90', 0.14),
    balance: metal('#e2bb78', 0.2, { roughnessMap: micro }),
    hairspring: metal('#7e8aa2', 0.34),
    mainspring: metal('#a3a9b1', 0.32),
    // Sunburst: brushed radially, so the light fans across the dial as it turns.
    dial: brushedMetal('#1d2024', 0.3, {
      metalness: 0.75,
      normalMap: radial,
      normalScale: v(0.18),
      anisotropy: 0.9,
      anisotropyMap: radialBrush,
    }),
    subDial: brushedMetal('#15171a', 0.34, { metalness: 0.6, anisotropy: 0.85, anisotropyMap: circular }),
    applied: metal('#f3f4f6', 0.05),
    handSteel: metal('#eef0f2', 0.17),
    lume: new THREE.MeshStandardMaterial({ color: '#ece6d2', roughness: 0.55, metalness: 0 }),
    caseSteel: metal('#e4e6e9', 0.08, { roughnessMap: micro }),
    // Turned parts (caseback) are lathe UVs: U runs around, so brushing is circular.
    caseBrushed: brushedMetal('#c6cacd', 0.3, { anisotropy: 0.7, roughnessMap: micro }),
    // Sapphire crystal: black and additive, so it contributes only its reflections
    // instead of veiling the dial.
    glass: new THREE.MeshPhysicalMaterial({
      color: '#000000',
      metalness: 0,
      roughness: 0.03,
      transparent: true,
      blending: THREE.AdditiveBlending,
      ior: 1.77,
      specularIntensity: 1,
      envMapIntensity: 1.3,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
    leather: new THREE.MeshStandardMaterial({
      color: '#3a2a20',
      roughness: 0.78,
      metalness: 0,
      normalMap: grain,
      normalScale: new THREE.Vector2(0.6, 0.6),
    }),
    stitch: new THREE.MeshStandardMaterial({ color: '#8b7d67', roughness: 0.8, metalness: 0 }),
  };
  return library;
}
