/**
 * Shown when WebGL is unavailable: the whole explanation, as text.
 */
export function Fallback() {
  return (
    <div className="fallback">
      <p className="eyebrow">Heartbeat 01 · How a mechanical watch works</p>
      <h1>
        <span>Seventeen jewels.</span>
        <span>One heartbeat.</span>
      </h1>
      <p className="body">This exhibit needs WebGL to show the movement in 3D. Here is the machine, step by step.</p>
      <ol>
        <li>
          <strong>Your hand → the mainspring.</strong> Turning the crown winds a steel spring inside the barrel. That spring is
          the watch’s only source of energy.
        </li>
        <li>
          <strong>The gear train.</strong> As the spring relaxes it turns the barrel, which drives a chain of wheels and pinions.
          Each step turns faster: the centre wheel once an hour, the fourth wheel once a minute.
        </li>
        <li>
          <strong>The escapement.</strong> The pallet fork holds the escape wheel still, then releases it half a tooth at a time.
          Each release is a tick.
        </li>
        <li>
          <strong>The balance.</strong> A wheel on a fine hairspring swings back and forth at a steady rate. It decides when the
          fork may release the next step, so the energy leaves the spring at a constant pace.
        </li>
        <li>
          <strong>Time.</strong> Those controlled steps turn the train, and the train carries the hands: minutes on the centre
          wheel, seconds on the fourth wheel.
        </li>
      </ol>
    </div>
  );
}

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
