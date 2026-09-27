/**
 * Site visit counter.
 *
 * GET  /api/visits → { visits }            current total
 * POST /api/visits → { visits, counted }   count this visitor (once per 30 minutes)
 *
 * Visitors are recognised by a salted SHA-256 hash of their IP, so refreshing
 * or reloading does not inflate the count, and raw IPs are never stored.
 */
import { Redis } from '@upstash/redis';
import { createHash } from 'node:crypto';

const TOTAL_KEY = 'heartbeat:visits';
const SEEN_PREFIX = 'heartbeat:seen:';
const DEDUPE_SECONDS = 30 * 60;

let client: Redis | null = null;

function redis(): Redis {
  if (client) return client;
  // Vercel's Upstash integration may use either naming scheme.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Visit counter storage is not configured');
  client = new Redis({ url, token });
  return client;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function visitorId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const salt = process.env.VISIT_SALT ?? 'heartbeat';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export async function GET(): Promise<Response> {
  try {
    const visits = (await redis().get<number>(TOTAL_KEY)) ?? 0;
    return json({ visits });
  } catch (error: unknown) {
    console.error('visits GET failed', error);
    return json({ error: 'Visit count unavailable' }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const db = redis();
    // SET NX succeeds only for a visitor not seen in the last 30 minutes.
    const fresh = await db.set(`${SEEN_PREFIX}${visitorId(request)}`, 1, { nx: true, ex: DEDUPE_SECONDS });
    const visits = fresh ? await db.incr(TOTAL_KEY) : ((await db.get<number>(TOTAL_KEY)) ?? 0);
    return json({ visits, counted: Boolean(fresh) });
  } catch (error: unknown) {
    console.error('visits POST failed', error);
    return json({ error: 'Visit count unavailable' }, 503);
  }
}
