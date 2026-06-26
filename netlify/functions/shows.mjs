// Upcoming shows from Ticketmaster's Discovery API for the venues TM carries
// (Emo's = Live Nation, Mohawk = on Ticketmaster). Hotel Vegas + Radio/East run
// on other platforms and are curated by hand in /events.json — the frontend
// merges both. Songkick's API is closed to new keys, so TM is the live source.
//
// GET /.netlify/functions/shows -> { events: [ {date, artist, venue, tickets, shooting} ] }
//
// Needs a free Ticketmaster Discovery key in the TICKETMASTER_API_KEY env var
// (developer.ticketmaster.com). Without it, returns an empty list so the site
// still works. Results cached ~6h in Netlify Blobs to stay well under quota.

import { getStore } from '@netlify/blobs';

const TM = 'https://app.ticketmaster.com/discovery/v2';
const CACHE_KEY = 'tm-cache';
const TTL_MS = 6 * 60 * 60 * 1000;           // 6 hours

// Venues to pull from Ticketmaster, with the display label used on the site.
const VENUES = [
  { label: "Emo's",  keyword: "Emo's Austin" },
  { label: 'Mohawk', keyword: 'Mohawk' },
];

// Isolate prod vs preview/branch stores by request host (same trick as likes.mjs).
function storeName(req) {
  const host = (req.headers.get('host') || '').toLowerCase();
  return host.includes('--') ? 'volumen-shows-preview' : 'volumen-shows';
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  });
}

// Resolve a Ticketmaster Discovery venue id by name, preferring the Austin match.
async function resolveVenueId(keyword, key) {
  const url = `${TM}/venues.json?keyword=${encodeURIComponent(keyword)}&stateCode=TX&size=10&apikey=${key}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  const venues = (d._embedded && d._embedded.venues) || [];
  const austin = venues.find((v) => v.city && /austin/i.test(v.city.name || ''));
  return (austin || venues[0] || {}).id || null;
}

// Fetch upcoming music events at a venue, normalized to the site's event shape.
async function fetchVenueEvents(venueId, label, key) {
  const url = `${TM}/events.json?venueId=${venueId}&classificationName=music&size=20&sort=date,asc&apikey=${key}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const d = await r.json();
  const evs = (d._embedded && d._embedded.events) || [];
  return evs
    .map((e) => ({
      date: e.dates && e.dates.start && e.dates.start.localDate,
      artist: e.name,
      venue: label,
      tickets: e.url || '',
      shooting: false,
      source: 'ticketmaster',
    }))
    .filter((e) => e.date && e.artist);
}

export default async (req) => {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return json({ events: [], note: 'TICKETMASTER_API_KEY not set' });

  let store = null;
  try { store = getStore({ name: storeName(req) }); } catch (e) { /* Blobs unavailable */ }

  // Serve a fresh cache if we have one.
  if (store) {
    try {
      const cached = await store.get(CACHE_KEY, { type: 'json' });
      if (cached && cached.t && (Date.now() - cached.t) < TTL_MS) {
        return json({ events: cached.events || [], cached: true });
      }
    } catch (e) { /* ignore */ }
  }

  // Refresh from Ticketmaster.
  let events = [];
  try {
    for (const v of VENUES) {
      const id = await resolveVenueId(v.keyword, key);
      if (!id) continue;
      events = events.concat(await fetchVenueEvents(id, v.label, key));
    }
  } catch (e) {
    // On failure, fall back to stale cache rather than going blank.
    if (store) {
      try {
        const c = await store.get(CACHE_KEY, { type: 'json' });
        if (c) return json({ events: c.events || [], stale: true });
      } catch (e2) { /* ignore */ }
    }
    return json({ events: [], error: 'fetch failed' });
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (store) { try { await store.setJSON(CACHE_KEY, { t: Date.now(), events }); } catch (e) { /* ignore */ } }
  return json({ events });
};
