// Community Picks "likes" + Photo of the Week — shared, persistent, backed by Netlify Blobs.
//
// GET  /.netlify/functions/likes
//   -> { counts: { key: n }, featured: { key, scope } }
// POST /.netlify/functions/likes  body:{ key, op }   op = 'like' | 'unlike'
//   -> { key, count, counts, featured }
//
// Two blobs:
//   counts  = { key: total }                  all-time likes (powers the Top-7 grid)
//   weekly  = { 'YYYY-MM-DD': { key: n } }     per-week likes, keyed by that week's Monday
// Read-modify-write isn't atomic, but at this site's traffic the window is negligible.
// "Photo of the Week" = the most-liked photo in the current week's bucket, falling back
// to last week, then all-time, then a frontend default — so it's never empty.
// Production and preview/branch deploys use separate stores (isolated by request host).

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

const COUNTS_KEY = 'counts';
const WEEKLY_KEY = 'weekly';

// Isolate production from preview/branch deploys by the request host, which is
// reliably present at runtime (process.env.CONTEXT is not). Production hosts
// (volumen.media, volumenmag.netlify.app) never contain '--'; deploy-preview and
// branch-deploy hosts always do (e.g. deploy-preview-4--volumenmag.netlify.app).
function storeName(req) {
  const host = (req.headers.get('host') || '').toLowerCase();
  return host.includes('--') ? 'volumen-likes-preview' : 'volumen-likes';
}

// Monday (UTC) of the week containing `d`, as 'YYYY-MM-DD'.
function weekStart(d = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay();                 // 0 Sun .. 6 Sat
  dt.setUTCDate(dt.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return dt.toISOString().slice(0, 10);
}
function prevWeekStart() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return weekStart(d);
}

// key with the highest positive value, or null
function topKey(obj) {
  let best = null, max = 0;
  for (const k in obj) { const v = Number(obj[k]) || 0; if (v > max) { max = v; best = k; } }
  return best;
}

// Photo of the Week: this week's leader, else last week's, else all-time, else default.
function computeFeatured(counts, weekly) {
  let key = topKey(weekly[weekStart()] || {});
  let scope = 'week';
  if (!key) { key = topKey(weekly[prevWeekStart()] || {}); scope = 'lastweek'; }
  if (!key) { key = topKey(counts); scope = 'alltime'; }
  if (!key) scope = 'default';
  return { key: key || null, scope };
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
    // consistent and a read right after a like can still see the old value.
    store = getStore({ name: storeName(req), consistency: 'strong' });
  } catch (err) {
    return json({ error: 'store unavailable' }, 503);
  }

  if (req.method === 'GET') {
    const counts = (await store.get(COUNTS_KEY, { type: 'json' })) || {};
    const weekly = (await store.get(WEEKLY_KEY, { type: 'json' })) || {};
    return json({ counts, featured: computeFeatured(counts, weekly) });
  }

  if (req.method === 'POST') {
    let body = {};
    try { body = await req.json(); } catch (err) { /* tolerate */ }
    const key = body && body.key;
    const op = body && body.op;
    if (!ALLOWED.has(key)) return json({ error: 'unknown key' }, 400);
    const delta = op === 'unlike' ? -1 : 1;

    // all-time tally (powers the Top-7), self-cleaning at zero
    const counts = (await store.get(COUNTS_KEY, { type: 'json' })) || {};
    const next = Math.max(0, (Number(counts[key]) || 0) + delta);
    if (next > 0) counts[key] = next; else delete counts[key];
    await store.setJSON(COUNTS_KEY, counts);

    // this week's bucket (powers Photo of the Week); prune to current + previous week
    const weekly = (await store.get(WEEKLY_KEY, { type: 'json' })) || {};
    const cw = weekStart();
    const bucket = weekly[cw] || (weekly[cw] = {});
    const wnext = Math.max(0, (Number(bucket[key]) || 0) + delta);
    if (wnext > 0) bucket[key] = wnext; else delete bucket[key];
    const keep = new Set([cw, prevWeekStart()]);
    for (const wk in weekly) { if (!keep.has(wk)) delete weekly[wk]; }
    await store.setJSON(WEEKLY_KEY, weekly);

    return json({ key, count: next, counts, featured: computeFeatured(counts, weekly) });
  }

  return json({ error: 'method not allowed' }, 405);
};
