/**
 * Heartbeat 01 assembled from story-driven parts.
 *
 * Explode order is chosen so that disassembly goes screws → bridges → barrel →
 * wheels → escapement → balance, and reassembly (the same stagger in reverse)
 * settles the escapement first and drives the screws home last.
 */
import type { Story } from '../animation/story';
import type { PartId } from '../movement/catalog';
import { ARBORS, BALANCE, ESCAPEMENT, LEVELS, WINDING, arborById, type Vec3 } from '../movement/config';
import { CLICK_PIVOT, FEATURED_JEWEL } from '../movement/layout';
import { Part, type PartProps } from './Part';
import { TrainArbor, Jewel } from './Mechanics';
import { BalanceWheel, Hairspring, PalletFork } from './Escapement';
import { BarrelDrum, BarrelLid, Click, Crown, CrownWheel, Mainspring, Ratchet, Stem } from './Barrel';
import { Bridge, BridgeScrews, Mainplate, bridgeById } from './Structure';
import { CrownHint } from './CrownHint';
import type { FocusGroup } from '../animation/emphasis';

interface Props {
  story: Story;
  onSelect: (id: PartId) => void;
}

const at = (p: readonly [number, number], z = 0): Vec3 => [p[0], p[1], z];
const up = (z: number): Vec3 => [0, 0, z];

const TRAIN: Record<string, { lift: number; order: number; label: Vec3; staff: readonly [number, number]; groups: FocusGroup[] }> = {
  center: { lift: 0.35, order: 0.62, label: [0.55, 0.3, 0.08], staff: [-0.04, LEVELS.trainBridge[1] + 0.14], groups: ['train', 'display'] },
  third: { lift: 0.95, order: 0.66, label: [0.5, -0.25, 0.27], staff: [-0.02, LEVELS.trainBridge[1]], groups: ['train'] },
  fourth: { lift: 0.7, order: 0.7, label: [-0.35, -0.42, 0.16], staff: [-0.02, LEVELS.trainBridge[1] + 0.1], groups: ['train', 'display'] },
  escape: { lift: 1.15, order: 0.78, label: [-0.18, -0.34, 0.27], staff: [-0.02, LEVELS.trainBridge[1]], groups: ['train', 'escapement'] },
};

const BRIDGE_LIFT: Record<'trainBridge' | 'barrelBridge' | 'palletCock' | 'balanceCock', { lift: number; order: number }> = {
  trainBridge: { lift: 2.3, order: 0.12 },
  barrelBridge: { lift: 2.0, order: 0.15 },
  palletCock: { lift: 1.65, order: 0.18 },
  balanceCock: { lift: 2.6, order: 0.08 },
};

export function Movement({ story, onSelect }: Props) {
  const common = { story, onSelect } satisfies Partial<PartProps>;
  const barrel = arborById('barrel').position;
  const stemAt: Vec3 = [WINDING.stemInnerX, WINDING.stemY, WINDING.stemZ];
  const winding: FocusGroup[] = ['winding'];

  return (
    <group>
      <Part {...common} id="mainplate" groups={['structure']} explode={{ offset: up(-1.1), order: 0.25 }} label={{ anchor: [1.75, -0.95, 0], sets: ['anatomy'] }}>
        <Mainplate />
      </Part>

      {/* Energy: barrel, mainspring and the winding chain */}
      <Part {...common} id="barrel" groups={['winding']} trainIndex={0} position={at(barrel)} explode={{ offset: up(0.55), order: 0.5 }} label={{ anchor: [0.6, 0.75, 0.4], sets: ['anatomy', 'winding'] }}>
        <BarrelDrum story={story} />
      </Part>
      <Part {...common} id="mainspring" groups={winding} position={at(barrel)} explode={{ offset: up(1.0), order: 0.45 }} label={{ anchor: [-0.45, 0.35, 0.37], sets: ['winding'] }}>
        <Mainspring story={story} />
      </Part>
      <Part {...common} id="barrelLid" groups={winding} behaviour="barrelLid" position={at(barrel)} explode={{ offset: up(1.45), order: 0.35 }} selectable={false}>
        <BarrelLid />
      </Part>
      <Part {...common} id="ratchet" groups={winding} behaviour="windingLift" position={at(barrel)} explode={{ offset: up(2.35), order: 0.2 }} label={{ anchor: [-0.3, 0.5, WINDING.topZ + 0.03], sets: ['winding'] }}>
        <Ratchet story={story} />
      </Part>
      <Part {...common} id="crownWheel" groups={winding} behaviour="windingLift" position={at(WINDING.crownWheel)} explode={{ offset: up(2.35), order: 0.2 }} label={{ anchor: [0.2, 0.2, WINDING.topZ + 0.03], sets: ['winding'] }}>
        <CrownWheel story={story} />
      </Part>
      <Part {...common} id="click" groups={winding} behaviour="windingLift" position={at(CLICK_PIVOT)} explode={{ offset: up(2.35), order: 0.2 }}>
        <Click story={story} />
      </Part>
      <Part {...common} id="stem" groups={winding} position={stemAt} explode={{ offset: [0.7, 0, 0], order: 0.3 }}>
        <Stem story={story} />
      </Part>
      <Part {...common} id="crown" groups={winding} position={[WINDING.crownX, WINDING.stemY, WINDING.stemZ]} explode={{ offset: [0.7, 0, 0], order: 0.3 }} label={{ anchor: [0.3, 0, 0.3], sets: ['anatomy', 'winding'] }}>
        <Crown story={story} />
        <CrownHint story={story} />
      </Part>

      {/* The gear train */}
      {ARBORS.filter(a => a.id !== 'barrel').map((arbor, i) => {
        const t = TRAIN[arbor.id];
        return (
          <Part
            {...common}
            key={arbor.id}
            id={arbor.id}
            groups={t.groups}
            trainIndex={i + 1}
            position={at(arbor.position)}
            explode={{ offset: up(t.lift), order: t.order }}
            label={{ anchor: t.label, sets: ['anatomy'] }}
          >
            <TrainArbor arbor={arbor} story={story} staff={t.staff} />
          </Part>
        );
      })}

      {/* Escapement and oscillator */}
      <Part {...common} id="pallet" groups={['escapement']} position={at(ESCAPEMENT.palletPivot)} explode={{ offset: up(1.35), order: 0.85 }} label={{ anchor: [0.12, -0.22, 0.28], sets: ['anatomy'] }}>
        <PalletFork story={story} />
      </Part>
      <Part {...common} id="balance" groups={['escapement', 'balance']} behaviour="balanceLift" position={at(BALANCE.center)} explode={{ offset: up(1.75), order: 0.92 }} label={{ anchor: [-0.5, -0.42, BALANCE.rimZ], sets: ['anatomy', 'balance'] }}>
        <BalanceWheel story={story} />
      </Part>
      <Part {...common} id="hairspring" groups={['escapement', 'balance']} behaviour="balanceLift" position={at(BALANCE.center)} explode={{ offset: up(2.05), order: 0.96 }} label={{ anchor: [0.12, 0.36, BALANCE.hairspringZ], sets: ['balance'] }}>
        <Hairspring story={story} />
      </Part>

      {/* Bridges lift away first; their screws lead the way */}
      {(Object.keys(BRIDGE_LIFT) as (keyof typeof BRIDGE_LIFT)[]).map(id => {
        const spec = bridgeById(id);
        const { lift, order } = BRIDGE_LIFT[id];
        const label: PartProps['label'] = id === 'trainBridge' ? { anchor: [1.35, -0.85, LEVELS.trainBridge[1]], sets: ['anatomy'] } : undefined;
        return (
          <group key={id}>
            <Part {...common} id={id} groups={['structure']} behaviour="bridge" explode={{ offset: up(lift), order }} label={label}>
              <Bridge spec={spec} />
            </Part>
            <Part {...common} id="screws" groups={['structure']} behaviour="bridge" explode={{ offset: up(lift + 0.75), order: 0 }} selectable={false}>
              <BridgeScrews spec={spec} />
            </Part>
          </group>
        );
      })}
      <Part {...common} id="jewel" groups={['structure']} behaviour="bridge" explode={{ offset: up(BRIDGE_LIFT.trainBridge.lift), order: BRIDGE_LIFT.trainBridge.order }} label={{ anchor: [FEATURED_JEWEL.at[0] + 0.05, FEATURED_JEWEL.at[1] + 0.05, FEATURED_JEWEL.z + 0.03], sets: ['anatomy'] }}>
        <Jewel position={[FEATURED_JEWEL.at[0], FEATURED_JEWEL.at[1], FEATURED_JEWEL.z]} />
      </Part>
    </group>
  );
}
