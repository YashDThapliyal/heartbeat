/**
 * Projects registered 3D anchors to screen and lays out engineering-style
 * annotations: two columns (left/right of the subject), no overlaps, thin
 * elbow leaders. Also renders the escapement's LOCK / UNLOCK / IMPULSE
 * callouts beside the stones. Writes the DOM directly; no React per frame.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Story } from '../animation/story';
import { CATALOG, type PartId } from '../movement/catalog';
import { CALLOUT_ANCHORS, forEachAnchor, type LabelAnchor, type LabelSet } from './labelRegistry';

/** What each moment of a beat means, shown right beside the stone doing it. */
const CALLOUT_TEXT = {
  LOCK: ['Locked', 'The ruby stone holds the wheel still'],
  UNLOCK: ['Unlocking', 'The balance flicks the fork; the stone slides clear'],
  IMPULSE: ['Impulse', 'The tooth pushes the stone: a kick for the balance'],
  DROP: ['Drop', 'Caught by the other stone. Tick.'],
} as const;

const SVG_NS = 'http://www.w3.org/2000/svg';
const GAP = 44;
const REACH = 84;

interface LabelNode {
  box: HTMLDivElement;
  leader: SVGPathElement;
  dot: SVGCircleElement;
}

interface Placed {
  node: LabelNode;
  sx: number;
  sy: number;
  y: number;
  side: -1 | 1;
  weight: number;
}

function isShown(obj: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function setWeights(story: Story, out: Record<LabelSet, number>): void {
  const l = story.frame.labels;
  out.anatomy = story.explore ? (story.controls.labels ? 1 : 0) : l.anatomy;
  out.winding = story.explore ? 0 : l.winding;
  out.escapement = story.explore ? 0 : l.escapement;
  out.balance = story.explore ? 0 : l.balance;
  // On the tour, part names give way to the story; the escapement callouts stay.
  if (story.touring) {
    out.anatomy = 0;
    out.winding = 0;
    out.balance = 0;
  }
  out.explore = story.explore && story.controls.labels ? 1 : 0;
}

function spread(items: Placed[], height: number): void {
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + GAP);
  const overflow = items.length ? items[items.length - 1].y - (height - 110) : 0;
  if (overflow > 0) for (const it of items) it.y -= overflow;
  for (let i = items.length - 2; i >= 0; i--) items[i].y = Math.min(items[i].y, items[i + 1].y - GAP);
}

interface ProjectorProps {
  story: Story;
  root: React.RefObject<HTMLDivElement | null>;
  /** In Explore, clicking a label selects its part. */
  onSelect: (id: PartId) => void;
}

export function LabelProjector({ story, root, onSelect }: ProjectorProps) {
  const select = useRef(onSelect);
  select.current = onSelect;
  const nodes = useRef(new Map<PartId, LabelNode>());
  const svg = useRef<SVGSVGElement | null>(null);
  const callout = useRef<{ box: HTMLDivElement; ring: HTMLDivElement; pin: HTMLDivElement } | null>(null);
  const weights = useMemo<Record<LabelSet, number>>(() => ({ anatomy: 0, winding: 0, escapement: 0, balance: 0, explore: 0 }), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  // Pooled per-frame scratch state (no allocation in the render loop).
  const scratch = useMemo(
    () => ({ left: [] as Placed[], right: [] as Placed[], pool: [] as Placed[], used: 0, seen: new Set<PartId>() }),
    [],
  );

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('class', 'leaders');
    container.appendChild(s);
    svg.current = s;
    const box = document.createElement('div');
    box.className = 'callout';
    const ring = document.createElement('div');
    ring.className = 'callout-ring';
    const pin = document.createElement('div');
    pin.className = 'callout callout-pin';
    pin.textContent = 'Push → balance';
    container.append(box, ring, pin);
    callout.current = { box, ring, pin };
    const created = nodes.current;
    return () => {
      s.remove();
      box.remove();
      ring.remove();
      pin.remove();
      created.forEach(n => n.box.remove());
      created.clear();
    };
  }, [root]);

  function nodeFor(a: LabelAnchor): LabelNode {
    let n = nodes.current.get(a.id);
    if (n) return n;
    const box = document.createElement('div');
    box.className = 'label';
    const name = document.createElement('strong');
    name.textContent = CATALOG[a.id].name;
    const role = document.createElement('span');
    role.textContent = CATALOG[a.id].role;
    box.append(name, role);
    box.addEventListener('click', () => {
      if (story.explore) select.current(a.id);
    });
    root.current!.appendChild(box);
    const leader = document.createElementNS(SVG_NS, 'path');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '2.2');
    svg.current!.append(leader, dot);
    n = { box, leader, dot };
    nodes.current.set(a.id, n);
    return n;
  }

  useFrame(({ camera, size }) => {
    if (!root.current || !svg.current) return;
    setWeights(story, weights);
    const w = size.width;
    const h = size.height;
    const compact = w < 700;
    origin.set(0, 0, 0.3).project(camera);
    const cx = (origin.x * 0.5 + 0.5) * w;
    const { left, right, pool, seen } = scratch;
    left.length = 0;
    right.length = 0;
    seen.clear();
    scratch.used = 0;

    forEachAnchor(a => {
      let weight = 0;
      for (const set of a.sets) weight = Math.max(weight, weights[set]);
      const focused = story.hovered === a.id || story.selected === a.id;
      if (focused && (story.explore || story.frame.hoverable)) weight = 1;
      if (compact && !focused) weight = 0;
      if (weight < 0.01 || !isShown(a.object)) return;
      a.object.getWorldPosition(v).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return;
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      const node = nodeFor(a);
      // Prefer the side away from the subject, unless the label would leave the screen.
      const width = node.box.offsetWidth || 160;
      let side: -1 | 1 = sx < cx ? -1 : 1;
      if (side > 0 && sx + REACH + width > w - 16) side = -1;
      else if (side < 0 && sx - REACH - width < 16) side = 1;
      const placed = pool[scratch.used] ?? (pool[scratch.used] = { node, sx, sy, y: 0, side, weight });
      scratch.used++;
      placed.node = node;
      placed.sx = sx;
      placed.sy = sy;
      placed.y = sy - 26;
      placed.side = side;
      placed.weight = weight;
      (side < 0 ? left : right).push(placed);
      seen.add(a.id);
    });
    spread(left, h);
    spread(right, h);

    for (let i = 0; i < scratch.used; i++) {
      const p = pool[i];
      const lx = p.sx + p.side * REACH;
      const { box, leader, dot } = p.node;
      box.style.opacity = String(p.weight);
      box.style.visibility = p.weight > 0.05 ? '' : 'hidden';
      box.style.transform = `translate(${lx}px, ${p.y}px) translate(${p.side < 0 ? '-100%' : '0'}, -50%)`;
      box.dataset.side = p.side < 0 ? 'left' : 'right';
      const elbow = p.sx + p.side * REACH * 0.55;
      leader.setAttribute('d', `M${p.sx},${p.sy} L${elbow},${p.y} L${lx - p.side * 6},${p.y}`);
      leader.style.opacity = String(p.weight * 0.8);
      dot.setAttribute('cx', String(p.sx));
      dot.setAttribute('cy', String(p.sy));
      dot.style.opacity = String(p.weight);
    }
    nodes.current.forEach((n, id) => {
      if (seen.has(id)) return;
      n.box.style.opacity = '0';
      n.box.style.visibility = 'hidden';
      n.leader.style.opacity = '0';
      n.dot.style.opacity = '0';
    });

    placeCallout(story, camera, w, h, v);
  });

  function placeCallout(s: Story, camera: THREE.Camera, w: number, h: number, tmp: THREE.Vector3) {
    const c = callout.current;
    if (!c) return;
    const weight = s.explore ? 0 : s.frame.labels.escapement;
    const esc = s.mech.escapement;
    const anchor = CALLOUT_ANCHORS[esc.stone];
    if (weight < 0.01 || !anchor || s.mech.beatBlur > 0.2) {
      c.box.style.opacity = c.ring.style.opacity = c.pin.style.opacity = '0';
      return;
    }
    anchor.getWorldPosition(tmp).project(camera);
    const x = (tmp.x * 0.5 + 0.5) * w;
    const y = (-tmp.y * 0.5 + 0.5) * h;
    const [title, line] = CALLOUT_TEXT[esc.phase];
    if (c.box.dataset.text !== title) {
      c.box.dataset.text = title;
      c.box.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = title;
      const small = document.createElement('small');
      small.textContent = line;
      c.box.append(strong, small);
    }
    c.box.dataset.phase = esc.phase;
    c.box.style.opacity = String(weight);
    c.box.style.transform = `translate(${x + 26}px, ${y - 34}px)`;
    c.ring.dataset.phase = esc.phase;
    c.ring.style.opacity = String(weight);
    c.ring.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    const pinAnchor = CALLOUT_ANCHORS.pin;
    const impulse = esc.phase === 'IMPULSE' || esc.phase === 'UNLOCK' ? weight : 0;
    if (pinAnchor && impulse > 0) {
      pinAnchor.getWorldPosition(tmp).project(camera);
      const px = (tmp.x * 0.5 + 0.5) * w;
      const py = (-tmp.y * 0.5 + 0.5) * h;
      c.pin.style.transform = `translate(${px + 18}px, ${py + 18}px)`;
    }
    c.pin.style.opacity = String(impulse);
  }

  return null;
}
