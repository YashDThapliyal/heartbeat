/**
 * The complete watch: exterior parts that open and stack, the movement, and
 * the energy guides. The root adds a slow idle drift and a hint of pointer parallax.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import type { PartId } from '../movement/catalog';
import { Part, type PartProps } from './Part';
import { Bezel, CaseBody, Crystal, Dial, Hand } from './Exterior';
import { Movement } from './Movement';
import { DisplayLinks, EnergyFlow } from './MechanismGuide';
import { EXTERIOR } from '../animation/exterior';
import { DragToTurn, freeTurnWeight } from './DragToTurn';

interface Props {
  story: Story;
  onSelect: (id: PartId) => void;
  /** Clicking the watch on the opening screens opens it. */
  onOpen: () => void;
}

export function Watch({ story, onSelect, onOpen }: Props) {
  const root = useRef<THREE.Group>(null!);
  const base = useRef({ x: 0, y: 0 });
  const common = { story, onSelect } satisfies Partial<PartProps>;

  useFrame(({ pointer }, dt) => {
    const calm = story.reduced || story.explore;
    const t = story.elapsed;
    const idleX = calm ? 0 : Math.sin(t * 0.21) * 0.018;
    const idleY = calm ? 0 : Math.sin(t * 0.17 + 1.3) * 0.024;
    const px = calm ? 0 : pointer.x * 0.035;
    const py = calm ? 0 : -pointer.y * 0.025;
    // Gentle drift and parallax are damped; the viewer's own turn is applied directly.
    const drift = base.current;
    drift.x = THREE.MathUtils.damp(drift.x, idleX + py, 3, dt);
    drift.y = THREE.MathUtils.damp(drift.y, idleY + px, 3, dt);
    root.current.rotation.set(drift.x + story.spin.x, drift.y + story.spin.y, 0);
  });

  return (
    <group
      ref={root}
      onPointerOver={() => {
        story.spin.overWatch = true;
      }}
      onPointerOut={() => {
        story.spin.overWatch = false;
      }}
      onClick={event => {
        // A click, not the end of a drag-to-turn.
        if (story.explore || freeTurnWeight(story) < 0.5 || event.delta > 6) return;
        event.stopPropagation();
        onOpen();
      }}
    >
      <Part {...common} id="case" behaviour="exterior" exterior={EXTERIOR.case}>
        <CaseBody />
      </Part>
      <Part {...common} id="bezel" behaviour="exterior" exterior={EXTERIOR.bezel}>
        <Bezel />
      </Part>
      <Part {...common} id="crystal" behaviour="exterior" exterior={EXTERIOR.crystal}>
        <Crystal />
      </Part>
      <Part {...common} id="dial" behaviour="dial" exterior={EXTERIOR.dial} selectable={false}>
        <Dial />
      </Part>
      {(['hour', 'minute', 'second'] as const).map(kind => (
        <Part
          {...common}
          key={kind}
          id={kind}
          groups={['display']}
          exterior={EXTERIOR.hands}
        >
          <Hand kind={kind} story={story} />
        </Part>
      ))}
      <Movement story={story} onSelect={onSelect} />
      <EnergyFlow story={story} />
      <DisplayLinks story={story} />
      <DragToTurn story={story} />
    </group>
  );
}
