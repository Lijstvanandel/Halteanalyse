import { BusStop } from '../types/bus';
import drglRoutesData from './drglRoutes.json';
import steenwijkerlandPolygonGeoJson from './steenwijkerlandPolygon.json';
import steenwijkerlandStopsData from './steenwijkerlandStops.json';

// Exact bounding box of Gemeente Steenwijkerland (covering all 186 stops and transit corridors)
export const STEENWIJKERLAND_BOUNDS = {
  north: 52.880,
  south: 52.620,
  west: 5.720,
  east: 6.250,
  center: {
    lat: 52.765,
    lng: 6.065,
  },
  defaultZoom: 12,
};

// Official 3,782-vertex GeoJSON MultiPolygon extracted directly from bestandkaart.html (cityData)
export const STEENWIJKERLAND_GEOJSON = steenwijkerlandPolygonGeoJson;

// Converted [lat, lng][] ring of the official Gemeente Steenwijkerland boundary
export const STEENWIJKERLAND_POLYGON: [number, number][] = (
  steenwijkerlandPolygonGeoJson.coordinates[0][0] as [number, number][]
).map(([lng, lat]) => [lat, lng]);

export function isPointInSteenwijkerland(lat: number, lng: number): boolean {
  if (
    lat < STEENWIJKERLAND_BOUNDS.south ||
    lat > STEENWIJKERLAND_BOUNDS.north ||
    lng < STEENWIJKERLAND_BOUNDS.west ||
    lng > STEENWIJKERLAND_BOUNDS.east
  ) {
    return false;
  }

  const vs = STEENWIJKERLAND_POLYGON;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][1];
    const yi = vs[i][0];
    const xj = vs[j][1];
    const yj = vs[j][0];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  if (inside) return true;

  // Proximity safety check: if point is within 2 km of any official Steenwijkerland stop, consider it inside
  for (const stop of STEENWIJKERLAND_STOPS) {
    const dLat = (stop.lat - lat) * 111000;
    const dLng = (stop.lng - lng) * 111000 * Math.cos((lat * Math.PI) / 180);
    if (dLat * dLat + dLng * dLng < 4000000) { // 2000m radius
      return true;
    }
  }

  return false;
}

// Exact 186 active bus stops extracted 1-on-1 from bestandkaart.html with official Plaats & Haltenaam
export const STEENWIJKERLAND_STOPS: BusStop[] = steenwijkerlandStopsData as BusStop[];

export interface LineRoute {
  line: string;
  name: string;
  operator: string;
  color: string;
  path: [number, number][];
}

// All bus routes from bestandkaart.html + DRGL (including Lijn 26 Steenwijk Station <=> Meppel Station)
export const BUS_ROUTES: LineRoute[] = (drglRoutesData as any[]).map((r) => ({
  line: r.line,
  name: r.name,
  operator: r.operator,
  color: r.color,
  path: r.path,
}));

export interface RouteMapBadge {
  line: string;
  label: string;
  subtitle: string;
  color: string;
  lat: number;
  lng: number;
}

// On-map route badges so key lines (especially Lijn 26 richting Meppel) are immediately identifiable on the map
export const ROUTE_MAP_BADGES: RouteMapBadge[] = [
  {
    line: '26',
    label: 'Lijn 26 → Meppel',
    subtitle: 'Bus 26: Steenwijk Station ⇔ Kallenkote ⇔ Nijeveen ⇔ Meppel Station',
    color: '#dc3545',
    lat: 52.7822,
    lng: 6.1422,
  },
  {
    line: '18',
    label: 'Lijn 18 → Oosterwolde',
    subtitle: 'Bus 18: Steenwijk Station ⇔ Eesveen ⇔ Noordwolde ⇔ Oosterwolde',
    color: '#e11d48',
    lat: 52.8165,
    lng: 6.1382,
  },
  {
    line: '20',
    label: 'Lijn 20 → Assen',
    subtitle: 'Bus 20: Steenwijk Station ⇔ Eesveen ⇔ Vledder ⇔ Assen',
    color: '#d97706',
    lat: 52.8255,
    lng: 6.1445,
  },
  {
    line: '524',
    label: 'Lijn 524 → Havelte',
    subtitle: 'Buurtbus 524: Steenwijk Station ⇔ Onnaseveld ⇔ Darp ⇔ Havelte',
    color: '#ea580c',
    lat: 52.7755,
    lng: 6.1635,
  },
  {
    line: '70',
    label: 'Lijn 70 / 270 ↔ Giethoorn',
    subtitle: 'Bus 70 & 270: Steenwijk Station ⇔ Giethoorn ⇔ Zwartsluis',
    color: '#00965E',
    lat: 52.7320,
    lng: 6.0780,
  },
  {
    line: '70',
    label: 'Lijn 70 ↔ Oldemarkt',
    subtitle: 'Bus 70: Steenwijk Station ⇔ Tuk ⇔ Steenwijkerwold ⇔ Oldemarkt',
    color: '#00965E',
    lat: 52.8105,
    lng: 6.0310,
  },
  {
    line: '214',
    label: 'Lijn 214 ↔ Blokzijl / Lelystad',
    subtitle: 'snelRRReis 214: Steenwijk ⇔ Scheerwolde ⇔ Wetering (N333) ⇔ Blokzijl ⇔ Lelystad',
    color: '#0086d6',
    lat: 52.7425,
    lng: 6.0040,
  },
  {
    line: '71',
    label: 'Lijn 71 / 171 ↔ Vollenhove',
    subtitle: 'Bus 71 & 171: Zwartsluis ⇔ Sint Jansklooster ⇔ Vollenhove ⇔ Emmeloord',
    color: '#059669',
    lat: 52.6795,
    lng: 5.9885,
  },
  {
    line: '76',
    label: 'Lijn 76 / 146 ↔ Ossenzijl / Kuinre',
    subtitle: 'Bus 76 & 146: Steenwijk ⇔ Oldemarkt ⇔ Ossenzijl ⇔ Kuinre',
    color: '#0d9488',
    lat: 52.8050,
    lng: 5.8950,
  },
  {
    line: '679',
    label: 'Lijn 679 ↔ Wanneperveen / Meppel',
    subtitle: 'Scholierenlijn 679: Vollenhove ⇔ Sint Jansklooster ⇔ Wanneperveen ⇔ Meppel',
    color: '#7c3aed',
    lat: 52.7018,
    lng: 6.1185,
  },
];
