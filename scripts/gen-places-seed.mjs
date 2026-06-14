// Generates supabase/migrations/0061_seed_places_dsmax.sql from the raw Overpass
// dump (ds_places_raw.json). One-off seed for DS Max Senate (Begur, Bangalore).
import { readFileSync, writeFileSync } from 'node:fs';

const COMMUNITY_ID = 'd836e935-4622-4289-8136-11ca73b54a39';
const CENTER = { lat: 12.8687464, lon: 77.6345485 }; // DS-MAX Senate, Begur

// OSM amenity/shop/leisure/healthcare tag → our place_type key.
const MAP = {
  hospital: 'hospital',
  clinic: 'clinic', doctors: 'clinic', dentist: 'clinic', laboratory: 'clinic', doctor: 'clinic', centre: 'clinic',
  pharmacy: 'pharmacy', chemist: 'pharmacy',
  school: 'school', college: 'school', university: 'school',
  kindergarten: 'daycare', childcare: 'daycare',
  supermarket: 'grocery', convenience: 'grocery', marketplace: 'grocery', greengrocer: 'grocery', butcher: 'grocery', department_store: 'grocery',
  hairdresser: 'salon', beauty: 'salon',
  restaurant: 'restaurant', cafe: 'restaurant', fast_food: 'restaurant', bakery: 'restaurant', confectionery: 'restaurant',
  fitness_centre: 'gym', sports_centre: 'gym',
  bank: 'bank', atm: 'bank',
  fuel: 'petrol', veterinary: 'vet', place_of_worship: 'worship',
  optician: 'other', hardware: 'other', mobile_phone: 'other', electronics: 'other',
  clothes: 'other', laundry: 'other', library: 'other', post_office: 'other',
};

// Max rows kept per our type (health kept generously; noisier types capped).
const CAP = {
  hospital: 16, clinic: 22, pharmacy: 16, school: 22, daycare: 10,
  grocery: 24, salon: 16, restaurant: 26, gym: 8, bank: 18,
  petrol: 8, vet: 6, worship: 14, other: 24,
};

const haversine = (a, b) => {
  const R = 6371, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const raw = JSON.parse(readFileSync('ds_places_raw.json', 'utf8')).elements;

const rows = [];
const seen = new Set();
for (const e of raw) {
  const t = e.tags || {};
  const osmKey = t.amenity || t.shop || t.leisure || t.healthcare;
  const place_type = MAP[osmKey];
  if (!place_type || !t.name) continue;
  const name = t.name.trim();
  const key = `${place_type}|${name.toLowerCase()}`;
  if (seen.has(key)) continue;
  seen.add(key);

  // Only keep an address if there's a real street/area part — a bare pincode
  // alone reads as junk in the UI (the lat/lng pin already covers location).
  const core = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] || t['addr:neighbourhood']].filter(Boolean);
  const address = core.length ? [...core, t['addr:postcode']].filter(Boolean).join(', ') : null;
  const phone = (t.phone || t['contact:phone'] || t['phone:mobile'] || '').trim() || null;
  const website = (t.website || t['contact:website'] || '').trim() || null;
  const hours = (t.opening_hours || '').replace(/\s+/g, ' ').trim() || null;

  rows.push({
    place_type, name, address,
    lat: e.lat, lng: e.lon, phone, website, hours,
    dist: haversine(CENTER, { lat: e.lat, lon: e.lon }),
    rich: (phone ? 1 : 0) + (website ? 1 : 0) + (hours ? 1 : 0) + (address ? 1 : 0),
  });
}

// Per-type cap: richest first, then nearest.
const byType = {};
for (const r of rows) (byType[r.place_type] ??= []).push(r);
const kept = [];
for (const [type, list] of Object.entries(byType)) {
  list.sort((a, b) => b.rich - a.rich || a.dist - b.dist);
  kept.push(...list.slice(0, CAP[type] ?? 8));
}
// Stable display order: by type (as in PLACE_TYPES), then name.
const TYPE_ORDER = ['hospital', 'clinic', 'pharmacy', 'school', 'daycare', 'grocery', 'salon', 'restaurant', 'gym', 'bank', 'petrol', 'vet', 'worship', 'other'];
kept.sort((a, b) => TYPE_ORDER.indexOf(a.place_type) - TYPE_ORDER.indexOf(b.place_type) || a.name.localeCompare(b.name));

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const valueRows = kept.map((r) =>
  `  (${q(r.place_type)}, ${q(r.name)}, ${q(r.address)}, ${r.lat}, ${r.lng}, ${q(r.phone)}, ${q(r.website)}, ${q(r.hours)})`
).join(',\n');

const counts = {};
kept.forEach((r) => (counts[r.place_type] = (counts[r.place_type] || 0) + 1));

const sql = `-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0061: Seed "Nearby" for DS Max Senate (Begur, Bangalore)
-- Run AFTER 0060.
--
-- ${kept.length} real nearby places sourced from OpenStreetMap (© OpenStreetMap
-- contributors, ODbL) around Begur (≈ ${CENTER.lat}, ${CENTER.lon}).
-- Counts: ${TYPE_ORDER.filter((t) => counts[t]).map((t) => `${t} ${counts[t]}`).join(', ')}.
--
-- Idempotent: each row is skipped if a place with the same name already exists
-- in this community, so re-running won't create duplicates. Attributed to the
-- community's admin (falls back to its earliest member); a no-op if neither
-- exists yet.
-- ════════════════════════════════════════════════════════════════════

with seeder as (
  select id from public.profiles
  where community_id = '${COMMUNITY_ID}'
  order by (roles @> '{admin}'::text[]) desc, created_at asc
  limit 1
)
insert into public.places (community_id, created_by, place_type, name, address, lat, lng, phone, website, hours)
select '${COMMUNITY_ID}', (select id from seeder), v.place_type, v.name, v.address, v.lat, v.lng, v.phone, v.website, v.hours
from (values
${valueRows}
) as v(place_type, name, address, lat, lng, phone, website, hours)
where (select id from seeder) is not null
  and not exists (
    select 1 from public.places p
    where p.community_id = '${COMMUNITY_ID}' and lower(p.name) = lower(v.name)
  );
`;

writeFileSync('supabase/migrations/0061_seed_places_dsmax.sql', sql);
console.log(`Wrote ${kept.length} places:`, JSON.stringify(counts));
