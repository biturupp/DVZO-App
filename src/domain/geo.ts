export interface LatLon {
  lat: number;
  lon: number;
}

/** Distanz in Metern (Haversine). */
export function distanceM(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLa = (b.lat - a.lat) * r;
  const dLo = (b.lon - a.lon) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Schweizer Landeskoordinaten (LV95, E/N in Metern) → WGS84. Näherungsformel von swisstopo (Genauigkeit ~1 m). */
export function lv95ToWgs84(east: number, north: number): LatLon {
  const y = (east - 2600000) / 1e6;
  const x = (north - 1200000) / 1e6;
  const lon = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y ** 3;
  const lat = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x ** 3;
  return { lat: (lat * 100) / 36, lon: (lon * 100) / 36 };
}

export interface ParsedCoord extends LatLon {
  format: 'WGS84' | 'LV95' | 'LV03';
}

/**
 * Liest Koordinaten aus Freitext:
 * «47.3868, 8.9690» (WGS84), «2'712'000 1'245'000» (LV95) oder «712000 245000» (LV03).
 */
export function parseCoordinates(input: string): ParsedCoord | null {
  const s = input.replace(/[’'`]/g, '').trim();
  if (!s) return null;
  let tokens = s.split(/[\s;]+|,\s+/).filter(Boolean);
  if (tokens.length === 1 && tokens[0].includes(',')) tokens = tokens[0].split(',');
  const nums = tokens.map((t) => parseFloat(t.replace(',', '.'))).filter((n) => !Number.isNaN(n));
  if (nums.length < 2) return null;
  let [a, b] = nums;
  if (a > 1e5 && b > 1e5) {
    let east = Math.max(a, b);
    let north = Math.min(a, b);
    let format: ParsedCoord['format'] = 'LV95';
    if (east < 1e6) {
      east += 2e6;
      north += 1e6;
      format = 'LV03';
    }
    return { ...lv95ToWgs84(east, north), format };
  }
  if (a < 15 && b > 40) [a, b] = [b, a];
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lon: b, format: 'WGS84' };
}
