// Community Picks "likes" — shared, persistent counts backed by Netlify Blobs.
// GET  /.netlify/functions/likes        -> { counts: { key: n, ... } }
// POST /.netlify/functions/likes  body:{ key, op }  op = 'like' | 'unlike'
//   -> { key, count, counts }
//
// Counts live in a single JSON blob. Read-modify-write is not atomic, but at this
// site's traffic the race window is negligible and self-corrects as likes accrue.
// Production and preview/branch deploys use separate stores so test likes made on
// a deploy preview never touch the real production tally.

import { getStore } from '@netlify/blobs';

// Allowlist of valid photo keys (filename stems) — blocks arbitrary keys from
// polluting the store. Must stay in sync with the gallery in index.html.
const ALLOWED = new Set([
  'concert-wide', 'singer-swirl', 'guitarist-floor', 'drummer-neon', 'viloria-crowd',
  'singer-bw', 'guitarist-stage', 'drummer-rear', 'singer-closeup', 'guitarist-tent',
  'wide-stage-view', 'singer-spotlight', 'crowd-reach', 'frontman-vinyl', 'drummer-overhead',
  'jumpsuit-duo', 'dancers-bw', 'singer-green', 'bassist-sequins', 'drummer-bw',
  'outdoor-smoke', 'bassist-noir', 'guitarist-bw', 'band-monochrome',
]);

const BLOB_KEY = 'counts';

// Isolate production from preview/branch deploys by the request host, which is
// reliably present at runtime (process.env.CONTEXT is not). Production hosts
// (volumen.media, volumenmag.netlify.app) never contain '--'; deploy-preview and
// branch-deploy hosts always do (e.g. deploy-preview-4--volumenmag.netlify.app).
function storeName(req) {
  const host = (req.headers.get('host') || '').toLowerCase();
  return host.includes('--') ? 'volumen-likes-preview' : 'volumen-likes';
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export default async (req) => {
  let store;
  try {
    // strong consistency = read-after-write. Without it Blobs is eventually
    // consistent and a read right after a like can still see the old value,
    // which would break the increment and the leaderboard ordering.
    store = getStore({ name: storeName(req), consistency: 'strong' });
  } catch (err) {
    return json({ error: 'store unavailable' }, 503);
  }

  if (req.method === 'GET') {
    const counts = (await store.get(BLOB_KEY, { type: 'json' })) || {};
    return json({ counts });
  }

  if (req.method === 'POST') {
    let body = {};
    try { body = await req.json(); } catch (err) { /* tolerate */ }
    const key = body && body.key;
    const op = body && body.op;
    if (!ALLOWED.has(key)) return json({ error: 'unknown key' }, 400);

    const counts = (await store.get(BLOB_KEY, { type: 'json' })) || {};
    const cur = Number(counts[key]) || 0;
    const next = op === 'unlike' ? Math.max(0, cur - 1) : cur + 1;
    if (next > 0) counts[key] = next; else delete counts[key];   // self-cleaning: drop zeros
    await store.setJSON(BLOB_KEY, counts);
    return json({ key, count: next, counts });
  }

  return json({ error: 'method not allowed' }, 405);
};
