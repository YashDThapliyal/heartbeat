/**
 * Free Explore mode: a slim instrument bar plus a component card.
 * Orbit, zoom and picking happen in the scene.
 */
import type { ExploreControls as Controls } from '../animation/story';
import { CATALOG, INDEXED_PARTS, type PartId } from '../movement/catalog';

const SPEEDS = [0.1, 0.25, 0.5, 1] as const;

interface Props {
  value: Controls;
  selected: PartId | null;
  onChange: (next: Controls) => void;
  onSelect: (id: PartId | null) => void;
  onReset: () => void;
  onExit: () => void;
}

export function ExploreControls({ value, selected, onChange, onSelect, onReset, onExit }: Props) {
  const info = selected ? CATALOG[selected] : null;
  return (
    <>
      <aside className="part-card" aria-live="polite">
        {info ? (
          <>
            <p className="eyebrow">Component</p>
            <h2>{info.name}</h2>
            <p className="body">{info.text}</p>
            <button type="button" className="text-button" onClick={() => onSelect(null)}>
              Show full movement
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">Explore</p>
            <h2>The movement, in your hands.</h2>
            <p className="body">Drag to turn it. Scroll or pinch to zoom. Select any part to learn what it does.</p>
          </>
        )}
        <label className="part-index">
          <span>Component index</span>
          <select value={selected ?? ''} onChange={e => onSelect((e.target.value || null) as PartId | null)}>
            <option value="">Full movement</option>
            {INDEXED_PARTS.map(id => (
              <option key={id} value={id}>
                {CATALOG[id].name}
              </option>
            ))}
          </select>
        </label>
      </aside>

      <div className="instrument" role="toolbar" aria-label="Movement controls">
        <button
          type="button"
          className="play"
          autoFocus
          onClick={() => onChange({ ...value, playing: !value.playing })}
          aria-pressed={!value.playing}
        >
          <span aria-hidden="true">{value.playing ? '❚❚' : '▶'}</span>
          {value.playing ? 'Pause' : 'Play'}
        </button>
        <div className="group" role="group" aria-label="Simulation speed">
          <span className="group-label">Speed</span>
          <div className="segmented">
            {SPEEDS.map(speed => (
              <button key={speed} type="button" aria-pressed={value.speed === speed} onClick={() => onChange({ ...value, speed })}>
                {speed}×
              </button>
            ))}
          </div>
        </div>
        <label className="group explode">
          <span className="group-label">
            Explode <output>{Math.round(value.explode * 100)}%</output>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={value.explode}
            onChange={e => onChange({ ...value, explode: Number(e.target.value) })}
          />
        </label>
        <button type="button" aria-pressed={value.labels} onClick={() => onChange({ ...value, labels: !value.labels })}>
          Labels {value.labels ? 'on' : 'off'}
        </button>
        <button type="button" onClick={onReset}>
          Reset view
        </button>
        <button type="button" className="exit" onClick={onExit}>
          Exit explore
        </button>
      </div>
    </>
  );
}
