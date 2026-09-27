import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIDGES, JEWEL_COUNT, JEWELS, PLATE } from '../src/movement/layout';
import { BALANCE, ESCAPEMENT, WINDING, arborById, PLATE_RADIUS } from '../src/movement/config';
import { traceShapes } from '../src/geometry/outline';
import { createWheel, createEscapeWheel } from '../src/geometry/gear';

test('the movement carries exactly seventeen jewels (the hero line depends on it)', () => {
  assert.equal(JEWEL_COUNT, 17);
});

test('each bridge covers the pivots whose jewels it carries', () => {
  for (const jewel of JEWELS) {
    if (jewel.carrier === 'mainplate') continue;
    const bridge = BRIDGES.find(b => b.id === jewel.carrier)!;
    assert.ok(bridge.sdf(jewel.at[0], jewel.at[1]) < -0.05, `${bridge.id} must surround pivot ${jewel.at}`);
  }
});

test('bridge feet stay on the plate and the winding stem is clear of the barrel bridge', () => {
  for (const bridge of BRIDGES) {
    for (const foot of bridge.feet) assert.ok(Math.hypot(...foot) < PLATE_RADIUS - 0.15, `${bridge.id} foot ${foot}`);
  }
  const barrelBridge = BRIDGES.find(b => b.id === 'barrelBridge')!;
  for (let x = WINDING.stemInnerX; x < PLATE_RADIUS; x += 0.02) {
    assert.ok(barrelBridge.sdf(x, WINDING.stemY) > 0.04, `stem collides with barrel bridge at x=${x.toFixed(2)}`);
  }
});

test('the balance clears the barrel and the plate edge', () => {
  const b = BALANCE.center;
  const barrel = arborById('barrel');
  assert.ok(Math.hypot(b[0] - barrel.position[0], b[1] - barrel.position[1]) > BALANCE.rimRadius + barrel.wheel.pitchRadius);
  assert.ok(Math.hypot(...b) + BALANCE.rimRadius < PLATE_RADIUS);
  assert.ok(Math.hypot(...ESCAPEMENT.palletPivot) < PLATE_RADIUS);
});

test('outlines trace into closed shapes with the expected holes', () => {
  for (const bridge of BRIDGES) {
    const shapes = traceShapes(bridge.sdf, bridge.bounds, 0.01);
    assert.equal(shapes.length, 1, `${bridge.id} is one piece`);
    assert.ok(shapes[0].getPoints().length > 40);
  }
  const train = traceShapes(BRIDGES[0].sdf, BRIDGES[0].bounds, 0.01);
  assert.equal(train[0].holes.length, 1, 'train bridge has its window');
  const plate = traceShapes(PLATE.outline, PLATE.bounds, 0.02);
  assert.equal(plate.length, 1);
});

test('procedural wheels are finite and reach their tip circle', () => {
  const g = createWheel({ teeth: 80, pitchRadius: 0.56, thickness: 0.045, spokes: 4 });
  const pos = g.attributes.position.array;
  assert.ok(Array.from(pos).every(Number.isFinite));
  g.computeBoundingSphere();
  assert.ok(g.boundingSphere!.radius > 0.56);
  const e = createEscapeWheel({ teeth: 15, tipRadius: 0.36, rootRadius: 0.265, thickness: 0.04, spokes: 4 });
  e.computeBoundingBox();
  assert.ok(Math.abs(e.boundingBox!.max.x - 0.36) < 0.01, 'tooth 0 locking corner lies on +X at the tip radius');
});
