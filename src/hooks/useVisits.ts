import { useSyncExternalStore } from 'react';

/**
 * Live site-visit count, shared by every component that shows it.
 * The first subscriber counts this visit; the total then refreshes every
 * 20 seconds while the tab is visible. If the counter is unavailable (for
 * example on the local dev server, which has no API), it stays hidden.
 */
const ENDPOINT = '/api/visits';
const REFRESH_MS = 20_000;

let visits: number | null = null;
let started = false;
const listeners = new Set<() => void>();

function publish(next: unknown): void {
  if (typeof next !== 'number' || !Number.isFinite(next) || next === visits) return;
  visits = next;
  listeners.forEach(l => l());
}

async function request(method: 'GET' | 'POST'): Promise<void> {
  try {
    const response = await fetch(ENDPOINT, { method, cache: 'no-store' });
    if (!response.ok) return;
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'visits' in body) publish((body as { visits: unknown }).visits);
  } catch {
    // Offline or no API: the counter simply stays hidden.
  }
}

function start(): void {
  if (started) return;
  started = true;
  void request('POST');
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void request('GET');
  }, REFRESH_MS);
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVisits(): number | null {
  return useSyncExternalStore(subscribe, () => visits, () => null);
}

export function formatVisits(n: number): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'site visit' : 'site visits'}`;
}
