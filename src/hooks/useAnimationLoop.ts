import { useEffect, useRef } from 'react';

/**
 * Runs a callback every animation frame for DOM-only updates (live numbers,
 * opacity) without re-rendering React.
 */
export function useAnimationLoop(callback: () => void): void {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    let id = 0;
    const tick = () => {
      saved.current();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}
