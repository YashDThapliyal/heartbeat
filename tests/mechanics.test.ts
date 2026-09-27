import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARBORS, ESCAPEMENT, BEATS_PER_SECOND, arborById, type ArborId } from '../src/movement/config';
import {
  escapementAt,
  trainAngles,
  angularVelocity,
  revolutionSeconds,
  handAngles,
  meshPhaseOffsets,
  TAU,
} from '../src/movement/simulation';

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('each wheel meshes its driven pinion at exactly the sum of pitch radii, with a shared module', () => {
  for (let i = 1; i < ARBORS.length; i++) {
    const driver = ARBORS[i - 1];
    const driven = ARBORS[i];
    assert.ok(driven.pinion, `${driven.id} needs a pinion`);
    assert.ok(close(driver.wheel.module, driven.pinion.module), `${driver.id}/${driven.id} module mismatch`);
    const expected = driver.wheel.pitchRadius + driven.pinion.pitchRadius;
    assert.ok(close(dist(driver.position, driven.position), expected, 1e-6), `${driven.id} centre distance`);
  }
});

test('the train uses real horological ratios', () => {
  assert.ok(close(revolutionSeconds('center'), 3600, 1e-6), 'centre wheel turns once an hour');
  assert.ok(close(revolutionSeconds('fourth'), 60, 1e-6), 'fourth wheel turns once a minute');
  assert.ok(close(revolutionSeconds('escape'), 6, 1e-6), 'escape wheel turns every six seconds');
  assert.ok(close(revolutionSeconds('barrel'), 8 * 3600, 1e-3), 'barrel turns every eight hours');
  assert.equal(BEATS_PER_SECOND * 3600, 18000);
});

test('meshing arbors rotate in opposite directions; minute and seconds arbors turn clockwise', () => {
  for (let i = 1; i < ARBORS.length; i++) {
    const a = angularVelocity(ARBORS[i - 1].id);
    const b = angularVelocity(ARBORS[i].id);
    assert.ok(a * b < 0, `${ARBORS[i - 1].id} and ${ARBORS[i].id} must counter-rotate`);
    const driver = ARBORS[i - 1];
    const driven = ARBORS[i];
    assert.ok(close(a * driver.wheel.pitchRadius, -b * driven.pinion!.pitchRadius, 1e-12), 'pitch-line speeds match');
  }
  assert.ok(angularVelocity('center') < 0);
  assert.ok(angularVelocity('fourth') < 0);
});

test('teeth never collide: every contact line keeps a tooth opposite a gap', () => {
  const offsets = meshPhaseOffsets();
  for (const t of [0, 0.37, 12.5, 1234.567]) {
    const angles = trainAngles(escapementAt(t).escapeAngle, offsets);
    for (let i = 1; i < ARBORS.length; i++) {
      const a = ARBORS[i - 1];
      const b = ARBORS[i];
      const d = Math.atan2(b.position[1] - a.position[1], b.position[0] - a.position[0]);
      const nA = (a.wheel.teeth * (d - angles[a.id])) / TAU;
      const nB = (b.pinion!.leaves * (d + Math.PI - angles[b.id])) / TAU;
      const frac = (((nA + nB) % 1) + 1) % 1;
      assert.ok(close(frac, 0.5, 1e-6), `${a.id}->${b.id} at t=${t} has ${frac}`);
    }
  }
});

test('escape wheel locks, then advances exactly half a tooth per beat, never backwards', () => {
  const half = TAU / ESCAPEMENT.teeth / 2;
  let previous = -Infinity;
  const beat = 1 / BEATS_PER_SECOND;
  for (let k = 0; k < 12; k++) {
    // Mid-way between crossings the balance is at an extremity: fully locked.
    const lockedA = escapementAt((k + 0.02) * beat);
    const lockedB = escapementAt((k + 0.3) * beat);
    const next = escapementAt((k + 1.02) * beat);
    assert.equal(lockedA.phase, 'LOCK');
    assert.ok(close(lockedA.escapeAngle, lockedB.escapeAngle), 'wheel is stationary while locked');
    assert.ok(close(next.escapeAngle - lockedA.escapeAngle, half, 1e-9), 'one half-pitch per beat');
  }
  for (let i = 0; i < 5000; i++) {
    const s = escapementAt(i / 997);
    assert.ok(s.escapeAngle >= previous - 1e-12, 'no reverse motion');
    previous = s.escapeAngle;
  }
});

test('the fork rests on its banking outside the lift and follows the impulse pin inside it', () => {
  const { forkBanking, liftHalfAngle, rollerRadius, forkLength } = ESCAPEMENT;
  for (let i = 0; i < 4000; i++) {
    const s = escapementAt(i / 1777);
    assert.ok(Math.abs(s.fork) <= forkBanking + 1e-12);
    if (Math.abs(s.balance) >= liftHalfAngle) {
      assert.ok(close(Math.abs(s.fork), forkBanking), 'fork on banking pin');
    } else {
      // Small-angle contact: pin and notch travel the same lateral distance.
      assert.ok(close(rollerRadius * s.balance, -forkLength * s.fork, 1e-9));
    }
  }
  assert.ok(escapementAt(0).balance * escapementAt(0.5 / 2.5).balance < 0, 'balance reverses');
});

test('escape wheel only moves while the fork is travelling, never while it is banked', () => {
  const half = TAU / ESCAPEMENT.teeth / 2;
  const origin = escapementAt(0).escapeAngle;
  for (let i = 0; i < 4000; i++) {
    const s = escapementAt(i / 1313);
    if (Math.abs(s.balance) >= ESCAPEMENT.liftHalfAngle) {
      const steps = (s.escapeAngle - origin) / half;
      assert.ok(close(steps, Math.round(steps), 1e-9), `wheel mid-step while banked at ${i}`);
    }
  }
});

test('hands are carried by the train: minutes on the centre arbor, seconds on the fourth arbor', () => {
  const offsets = meshPhaseOffsets();
  const at = (t: number) => {
    const angles = trainAngles(escapementAt(t).escapeAngle, offsets);
    return { angles, hands: handAngles(angles, offsets) };
  };
  const a = at(4321.25);
  const b = at(4321.25 + 3600);
  assert.ok(close(a.hands.minute - a.angles.center, b.hands.minute - b.angles.center), 'minute hand fixed to centre arbor');
  assert.ok(close(a.hands.second - a.angles.fourth, b.hands.second - b.angles.fourth), 'seconds hand fixed to fourth arbor');
  assert.ok(close(b.hands.minute - a.hands.minute, -TAU, 1e-6), 'minute hand: one clockwise turn per hour');
  assert.ok(close(b.hands.hour - a.hands.hour, -TAU / 12, 1e-6), 'hour hand: 12:1 motion works');
  // Simulation time is seconds after midnight, so 03:00:00 reads as three o'clock.
  const three = at(3 * 3600);
  assert.ok(close(((three.hands.hour % TAU) + TAU) % TAU, TAU - TAU / 4, 1e-6));
  assert.ok(close(((three.hands.minute % TAU) + TAU) % TAU, 0, 1e-6) || close(((three.hands.minute % TAU) + TAU) % TAU, TAU, 1e-6));
});

test('arbor lookup is total', () => {
  const ids: ArborId[] = ['barrel', 'center', 'third', 'fourth', 'escape'];
  for (const id of ids) assert.equal(arborById(id).id, id);
});
