import { useEffect, useRef } from 'react';
import type { Story } from '../animation/story';
import { ESCAPEMENT } from '../movement/config';

/** Above this simulation rate ticks would merge into a buzz, so stay quiet. */
const MAX_RATE = 1.5;

/** A short synthesized tick: filtered noise plus a faint metallic ping. */
function playTick(ctx: AudioContext, tock: boolean, volume: number): void {
  const t = ctx.currentTime;
  const length = Math.floor(ctx.sampleRate * 0.03);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.12));
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = tock ? 3600 : 4200;
  band.Q.value = 3;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  noise.connect(band).connect(gain).connect(ctx.destination);
  noise.start(t);

  const ping = ctx.createOscillator();
  ping.frequency.value = tock ? 2900 : 3300;
  const pingGain = ctx.createGain();
  pingGain.gain.setValueAtTime(volume * 0.08, t);
  pingGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  ping.connect(pingGain).connect(ctx.destination);
  ping.start(t);
  ping.stop(t + 0.06);
}

/**
 * Plays a tick each time the escape wheel drops onto a locking stone.
 * Off by default; audio starts only after the user turns it on.
 */
export function useTickSound(story: Story, enabled: boolean): void {
  const ctx = useRef<AudioContext | null>(null);
  const lastBeat = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    try {
      ctx.current ??= new AudioContext();
      void ctx.current.resume();
    } catch (error: unknown) {
      console.error('Audio unavailable', error);
      return;
    }
    let id = 0;
    const loop = () => {
      const audio = ctx.current;
      const esc = story.mech.escapement;
      const rate = Math.abs(story.mech.rate);
      if (audio && rate > 0 && rate <= MAX_RATE && esc.progress >= ESCAPEMENT.dropEndsAt && lastBeat.current !== esc.beat) {
        if (lastBeat.current !== null) playTick(audio, esc.tick === 'TOCK', rate < 0.5 ? 0.5 : 0.28);
        lastBeat.current = esc.beat;
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      lastBeat.current = null;
      void ctx.current?.suspend();
    };
  }, [enabled, story]);

  useEffect(
    () => () => {
      void ctx.current?.close();
      ctx.current = null;
    },
    [],
  );
}
