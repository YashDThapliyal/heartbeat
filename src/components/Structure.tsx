/**
 * The frame of the movement: perlaged mainplate, Côtes de Genève bridges with
 * polished bevels, their pillars, jewels and blued screws.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { BRIDGES, CAP_JEWELS, FEATURED_JEWEL, JEWELS, PLATE, RIM_SCREWS, type BridgeSpec } from '../movement/layout';
import { LEVELS } from '../movement/config';
import { getMaterials } from '../movement/materials';
import { circle, createSlab, subtract } from '../geometry/outline';
import { Jewel, Screw, cylinder } from './Mechanics';

const PLATE_THICKNESS = LEVELS.plateTop - LEVELS.plateBottom;

export function Mainplate() {
  const m = getMaterials();
  const plate = useMemo(() => {
    const sdf = subtract(PLATE.outline, ...PLATE.pockets.map(p => circle(p.center, p.radius)));
    const g = createSlab(sdf, { thickness: PLATE_THICKNESS, bevel: 0.025, cell: 0.01, bounds: PLATE.bounds });
    g.translate(0, 0, LEVELS.plateBottom);
    return g;
  }, []);
  const floors = useMemo(
    () => PLATE.pockets.map(p => ({ geometry: new THREE.CircleGeometry(p.radius + 0.01, 96), p })),
    [],
  );
  const jewels = JEWELS.filter(j => j.carrier === 'mainplate');
  return (
    <group>
      <mesh geometry={plate} material={[m.plate, m.plateSide]} receiveShadow castShadow />
      {floors.map(({ geometry, p }, i) => (
        <mesh key={i} geometry={geometry} material={m.plateSink} position={[p.center[0], p.center[1], -p.depth]} receiveShadow />
      ))}
      {jewels.map((j, i) => (
        <Jewel key={i} position={[j.at[0], j.at[1], j.z]} radius={0.06} />
      ))}
      {CAP_JEWELS.filter(j => j.carrier === 'mainplate').map((j, i) => (
        <Jewel key={`cap${i}`} position={[j.at[0], j.at[1], j.z]} radius={0.06} cap />
      ))}
      {RIM_SCREWS.map((s, i) => (
        <Screw key={i} position={[s[0], s[1], 0]} radius={0.06} blued={false} />
      ))}
    </group>
  );
}

export function Bridge({ spec }: { spec: BridgeSpec }) {
  const m = getMaterials();
  const [z0, z1] = spec.z;
  const slab = useMemo(
    () => createSlab(spec.sdf, { thickness: z1 - z0, bevel: 0.014, cell: 0.007, bounds: spec.bounds }),
    [spec, z0, z1],
  );
  const jewels = JEWELS.filter(j => j.carrier === spec.id && j !== FEATURED_JEWEL);
  const caps = CAP_JEWELS.filter(j => j.carrier === spec.id);
  return (
    <group>
      <mesh geometry={slab} material={[m.rhodium, m.anglage]} position={[0, 0, z0]} castShadow receiveShadow />
      {spec.feet.map((f, i) => (
        <mesh key={i} geometry={cylinder(0.075, z0, 20)} material={m.plateSide} position={[f[0], f[1], z0 / 2]} />
      ))}
      {jewels.map((j, i) => (
        <Jewel key={i} position={[j.at[0], j.at[1], j.z]} radius={spec.id === 'balanceCock' ? 0.075 : 0.065} />
      ))}
      {caps.map((j, i) => (
        <Jewel key={`cap${i}`} position={[j.at[0], j.at[1], j.z]} radius={0.075} cap />
      ))}
    </group>
  );
}

export function BridgeScrews({ spec }: { spec: BridgeSpec }) {
  return (
    <group>
      {spec.screws.map((s, i) => (
        <Screw key={i} position={[s[0], s[1], spec.z[1]]} radius={spec.id === 'palletCock' ? 0.06 : 0.075} />
      ))}
    </group>
  );
}

export const bridgeById = (id: BridgeSpec['id']): BridgeSpec => {
  const b = BRIDGES.find(x => x.id === id);
  if (!b) throw new Error(`Unknown bridge ${id}`);
  return b;
};
