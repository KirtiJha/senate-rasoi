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
  /** For telling two societies of the same name in different places apart. */
  state: string | null;
  pincode: string | null;
}

/**
 * Search OpenStreetMap for a society, anywhere in India.
 *
 * This used to pass a Bengaluru bounding box with `bounded=1`, which tells
 * Nominatim to return NOTHING outside that rectangle. Aangan is for the whole
 * country: a resident in Pune, Kochi or Guwahati typed their society's name,
 * got "No matches", and had no way to know the search had never looked. The
 * only filter now is the country.
 *
 * Throws on a network or service failure rather than returning an empty list,
 * because "we could not reach the map" and "your society is not on the map"
 * lead to completely different next steps for the person reading the screen.
 */
export async function searchSocieties(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '10',
      countrycodes: 'in',
    }).toString();

  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Aangan/1.0' }, signal });
  if (!res.ok) throw new Error('place-search-unavailable');
  const data = (await res.json()) as any[];
  return data.map((r) => {
    const a = r.address ?? {};
    return {
      osmId: `${r.osm_type ?? 'n'}:${r.osm_id}`,
      name: r.name || (typeof r.display_name === 'string' ? r.display_name.split(',')[0] : 'Society'),
      address: r.display_name ?? '',
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      // No default city any more. Guessing "Bengaluru" for a place in Jaipur
      // is worse than leaving it unknown.
      city: a.city ?? a.town ?? a.municipality ?? a.village ?? a.suburb ?? null,
      state: a.state ?? null,
      pincode: a.postcode ?? null,
    };
  });
}

/** "Whitefield, Bengaluru, Karnataka" — what tells two identical names apart. */
export function placeWhere(p: { city: string | null; state: string | null; pincode?: string | null }): string {
  return [p.city, p.state, p.pincode].filter(Boolean).join(', ');
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

// ── Open-in-Maps deep links (no API key needed) ─────────────────────

/** Google Maps — drops a pin at the coords (or searches the label if given). */
export function googleMapsLink(lat: number | null, lon: number | null, label?: string | null): string {
  if (lat != null && lon != null) {
    const q = `${lat},${lon}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label ?? '')}`;
}

/** Apple Maps — drops a pin at the coords (or searches the label if given). */
export function appleMapsLink(lat: number | null, lon: number | null, label?: string | null): string {
  const name = label ? `&q=${encodeURIComponent(label)}` : '';
  if (lat != null && lon != null) return `https://maps.apple.com/?ll=${lat},${lon}${name || `&q=${lat},${lon}`}`;
  return `https://maps.apple.com/?q=${encodeURIComponent(label ?? '')}`;
}

/**
 * Forward-geocode a free-form place query (shops, hospitals, schools …).
 *
 * This carried the same Bengaluru bounding box as the society search did, so a
 * society in Pune could not add its own hospital to Nearby. "Nearby" is now
 * measured from the society itself: pass its coordinates and results are kept
 * within about 50 km of it, which is what the word means in every city. With
 * no coordinates the search widens to the whole country rather than silently
 * looking in the wrong one.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  near?: { lat: number; lon: number } | null,
): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params: Record<string, string> = {
    q, format: 'jsonv2', addressdetails: '1', limit: '10', countrycodes: 'in',
  };
  if (near) {
    const d = 0.45; // ≈50 km
    params.viewbox = `${near.lon - d},${near.lat - d},${near.lon + d},${near.lat + d}`;
    params.bounded = '1';
  }
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams(params).toString();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Aangan/1.0' }, signal });
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    return data.map((r) => {
      const a = r.address ?? {};
      return {
        osmId: `${r.osm_type ?? 'n'}:${r.osm_id}`,
        name: r.name || (typeof r.display_name === 'string' ? r.display_name.split(',')[0] : 'Place'),
        address: r.display_name ?? '',
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        city: a.city ?? a.town ?? a.municipality ?? a.village ?? a.suburb ?? null,
        state: a.state ?? null,
        pincode: a.postcode ?? null,
      };
    });
  } catch {
    return [];
  }
}
