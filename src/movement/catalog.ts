/**
 * Every selectable component, with the short explanation shown in labels and
 * in Explore mode. Text is intentionally brief.
 */

export type PartId =
  | 'crown'
  | 'stem'
  | 'crownWheel'
  | 'ratchet'
  | 'click'
  | 'mainspring'
  | 'barrel'
  | 'barrelLid'
  | 'center'
  | 'third'
  | 'fourth'
  | 'escape'
  | 'pallet'
  | 'balance'
  | 'hairspring'
  | 'jewel'
  | 'trainBridge'
  | 'barrelBridge'
  | 'palletCock'
  | 'balanceCock'
  | 'mainplate'
  | 'dial'
  | 'hour'
  | 'minute'
  | 'second'
  | 'case'
  | 'bezel'
  | 'crystal'
  | 'strap'
  | 'screws';

export interface PartInfo {
  name: string;
  /** One-line purpose for annotations. */
  role: string;
  /** One or two sentences for Explore mode. */
  text: string;
  /** Listed in the Explore index. */
  indexed: boolean;
}

export const CATALOG: Record<PartId, PartInfo> = {
  crown: {
    name: 'Crown',
    role: 'Your hand winds the watch here',
    text: 'Turning the crown spins the winding stem. That rotation is carried through two wheels to the mainspring.',
    indexed: true,
  },
  stem: {
    name: 'Winding stem',
    role: 'Carries the crown’s rotation inward',
    text: 'The stem passes through the case. Its winding pinion turns the crown wheel.',
    indexed: false,
  },
  crownWheel: {
    name: 'Crown wheel',
    role: 'Turns the winding through the movement',
    text: 'Driven by the winding pinion on the stem, it passes your winding on to the ratchet wheel.',
    indexed: true,
  },
  ratchet: {
    name: 'Ratchet wheel',
    role: 'Winds the mainspring arbor',
    text: 'Fixed to the barrel arbor, it coils the mainspring. The click lets it turn only one way.',
    indexed: true,
  },
  click: {
    name: 'Click',
    role: 'Stops the spring unwinding backwards',
    text: 'A small pawl that drops into the ratchet teeth, so the stored energy can only leave through the gear train.',
    indexed: false,
  },
  mainspring: {
    name: 'Mainspring',
    role: 'Stores the energy',
    text: 'A long ribbon of steel coiled inside the barrel. Winding tightens it; as it relaxes it turns the barrel.',
    indexed: true,
  },
  barrel: {
    name: 'Mainspring barrel',
    role: 'Delivers the spring’s power',
    text: 'A toothed drum housing the mainspring. It turns once every eight hours and drives the centre wheel.',
    indexed: true,
  },
  barrelLid: {
    name: 'Barrel cover',
    role: 'Closes the barrel',
    text: 'The lid that keeps the mainspring inside its drum.',
    indexed: false,
  },
  center: {
    name: 'Centre wheel',
    role: 'Turns once an hour',
    text: 'Driven by the barrel, it turns exactly once an hour. Its arbor carries the minute hand.',
    indexed: true,
  },
  third: {
    name: 'Third wheel',
    role: 'Steps the speed up',
    text: 'Turns once every seven and a half minutes, carrying power from the centre wheel to the fourth wheel.',
    indexed: true,
  },
  fourth: {
    name: 'Fourth wheel',
    role: 'Turns once a minute',
    text: 'Turns exactly once a minute, so its arbor carries the small seconds hand. It drives the escape wheel.',
    indexed: true,
  },
  escape: {
    name: 'Escape wheel',
    role: 'Released one step at a time',
    text: 'The last wheel of the train. The pallet stones hold it, then let it advance half a tooth at a time.',
    indexed: true,
  },
  pallet: {
    name: 'Pallet fork',
    role: 'Locks and releases the escape wheel',
    text: 'Its two ruby stones take turns stopping the escape wheel. Each release returns a small push to the balance.',
    indexed: true,
  },
  balance: {
    name: 'Balance wheel',
    role: 'Sets the rhythm',
    text: 'Swings back and forth two and a half times a second. It decides when the escapement may release the next step.',
    indexed: true,
  },
  hairspring: {
    name: 'Hairspring',
    role: 'Returns the balance, every swing alike',
    text: 'A spiral finer than a hair. It pulls the balance back toward rest, so each swing takes the same time.',
    indexed: true,
  },
  jewel: {
    name: 'Jewel bearing',
    role: 'A hard, low-friction bearing',
    text: 'Synthetic ruby supports each fast-turning pivot with very little friction or wear. This movement has seventeen.',
    indexed: true,
  },
  trainBridge: {
    name: 'Train bridge',
    role: 'Holds the wheels in line',
    text: 'A rigid plate screwed above the gear train. Its jewels hold the top pivots of four wheels.',
    indexed: true,
  },
  barrelBridge: {
    name: 'Barrel bridge',
    role: 'Holds the barrel and winding wheels',
    text: 'Supports the barrel arbor, with the ratchet and crown wheels on top.',
    indexed: false,
  },
  palletCock: {
    name: 'Pallet bridge',
    role: 'Holds the pallet fork',
    text: 'A small bridge carrying the top jewel of the pallet fork’s arbor.',
    indexed: false,
  },
  balanceCock: {
    name: 'Balance cock',
    role: 'Holds the balance',
    text: 'A single-footed bridge that supports the balance from above, with a jewel and cap jewel.',
    indexed: true,
  },
  mainplate: {
    name: 'Mainplate',
    role: 'The foundation',
    text: 'Every bridge and pivot is located on this plate. It keeps the whole mechanism in alignment.',
    indexed: true,
  },
  dial: {
    name: 'Dial',
    role: 'The face of the watch',
    text: 'Printed with the minute track and small seconds. It hides the machine that moves the hands.',
    indexed: true,
  },
  hour: {
    name: 'Hour hand',
    role: 'One turn every twelve hours',
    text: 'Driven through 12:1 motion works from the centre wheel.',
    indexed: true,
  },
  minute: {
    name: 'Minute hand',
    role: 'Rides the centre wheel',
    text: 'Mounted on the centre wheel’s arbor, so it turns once an hour.',
    indexed: true,
  },
  second: {
    name: 'Seconds hand',
    role: 'Rides the fourth wheel',
    text: 'Mounted on the fourth wheel’s arbor, so it turns once a minute, advancing with every beat.',
    indexed: true,
  },
  case: {
    name: 'Case',
    role: 'Protects the movement',
    text: 'Polished and brushed steel that seals the movement from dust and moisture.',
    indexed: false,
  },
  bezel: {
    name: 'Bezel',
    role: 'Holds the crystal',
    text: 'The polished ring that secures the crystal to the case.',
    indexed: false,
  },
  crystal: {
    name: 'Crystal',
    role: 'Clear protection for the dial',
    text: 'A transparent window over the dial and hands.',
    indexed: false,
  },
  strap: {
    name: 'Strap',
    role: 'Holds the watch on the wrist',
    text: 'Leather strap fixed between the lugs.',
    indexed: false,
  },
  screws: {
    name: 'Screws',
    role: 'Fix the bridges to the plate',
    text: 'Blued steel screws hold each bridge in place. Heat bluing protects the steel and makes it easy to see.',
    indexed: false,
  },
};

export const INDEXED_PARTS = (Object.keys(CATALOG) as PartId[]).filter(id => CATALOG[id].indexed);
