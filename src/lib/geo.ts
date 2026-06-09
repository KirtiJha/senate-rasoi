// Free location services via OpenStreetMap — no API key.
//  - Nominatim for searching societies/apartments (usage policy: <=1 req/sec,
//    a Referer/User-Agent; we debounce in the UI).
//  - A static map image for the location preview.

export interface Place {
  osmId: string; // `${osm_type}:${osm_id}` — a stable de-dupe key
  name: string;
  address: string;
  lat: number;
  lon: number;
  city: string | null;
}

// Bengaluru bounding box (lon/lat min,max) so results stay local.
const BLR_VIEWBOX = '77.35,12.74,77.95,13.25';

export async function searchSocieties(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '8',
      countrycodes: 'in',
      viewbox: BLR_VIEWBOX,
      bounded: '1',
    }).toString();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Aangan/1.0' }, signal });
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    return data.map((r) => ({
      osmId: `${r.osm_type ?? 'n'}:${r.osm_id}`,
      name: r.name || (typeof r.display_name === 'string' ? r.display_name.split(',')[0] : 'Society'),
      address: r.display_name ?? '',
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      city: r.address?.city ?? r.address?.town ?? r.address?.suburb ?? 'Bengaluru',
    }));
  } catch {
    return [];
  }
}

// ── Slippy-map tile helpers (OpenStreetMap tile CDN) ────────────────
export const TILE = 256;
export function tileMath(lat: number, lon: number, zoom = 16) {
  const n = 2 ** zoom;
  const fx = ((lon + 180) / 360) * n;
  const fy = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  return { zoom, fx, fy, cx: Math.floor(fx), cy: Math.floor(fy) };
}
export const tileUrl = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** Deep link to the full map (opens openstreetmap.org). */
export function osmMapLink(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}
