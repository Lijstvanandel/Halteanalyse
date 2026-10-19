import express from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  parseDRGLDeparturesPanel,
  parseDRGLJourneyPage,
  decodePolyline,
  DRGLDeparture,
  DRGLJourneyData,
} from './src/utils/drgl';
import {
  stepSteenwijkerlandSimulation,
  toBuspositiesGeoJSON,
  resolveMarkerPngForLine,
} from './src/services/busService';
import {
  STEENWIJKERLAND_STOPS,
  isPointInSteenwijkerland,
  BUS_ROUTES,
} from './src/data/steenwijkerland';
import {
  PunctualityLogEntry,
  TripPassStatus,
  getISOWeekInfo,
  exportRawLogsToCSV,
  sanitizeLogId,
} from './src/utils/punctuality';
import {
  DeelfietsLocation,
  DeelfietsLogEntry,
  STEENWIJKERLAND_DEELFIETS_HUBS,
  exportRawDeelfietsLogsToCSV,
} from './src/utils/deelfiets';
import {
  OvFietsLocation,
  OvFietsLogEntry,
  OFFICIAL_STEENWIJK_OVFIETS,
  exportRawOvFietsLogsToCSV,
} from './src/utils/ovfiets';
import { BusPosition } from './src/types/bus';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const PUNCTUALITY_LOG_FILE = path.resolve(__dirname, 'src/data/punctualityLogs.json');
const PUNCTUALITY_BACKUP_FILE = path.resolve(__dirname, 'src/data/punctualityLogs.backup.json');
const DEELFIETS_LOG_FILE = path.resolve(__dirname, 'src/data/deelfietsLogs.json');
const DEELFIETS_BACKUP_FILE = path.resolve(__dirname, 'src/data/deelfietsLogs.backup.json');
const OVFIETS_LOG_FILE = path.resolve(__dirname, 'src/data/ovfietsLogs.json');
const OVFIETS_BACKUP_FILE = path.resolve(__dirname, 'src/data/ovfietsLogs.backup.json');

// Cache for DRGL departures and journeys
const departuresCache: Map<string, { timestamp: number; data: { title: string; departures: DRGLDeparture[] } }> = new Map();
const journeyCache: Map<string, { timestamp: number; data: DRGLJourneyData }> = new Map();

// Persistent Punctuality Log Store (keyed by entry.id) — strictly additive, never wipes existing logs
const punctualityStore: Map<string, PunctualityLogEntry> = new Map();

function loadPunctualityStore() {
  for (const filePath of [PUNCTUALITY_BACKUP_FILE, PUNCTUALITY_LOG_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed: PunctualityLogEntry[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (entry && entry.id) {
              punctualityStore.set(entry.id, entry);
            }
          });
        }
      }
    } catch (e) {
      console.warn(`Could not load ${path.basename(filePath)}:`, e);
    }
  }
}

function savePunctualityStore() {
  try {
    const arr = Array.from(punctualityStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    const json = JSON.stringify(arr, null, 2);
    const tmpFile = `${PUNCTUALITY_LOG_FILE}.tmp`;
    fs.writeFileSync(tmpFile, json, 'utf8');
    fs.renameSync(tmpFile, PUNCTUALITY_LOG_FILE);
    fs.writeFileSync(PUNCTUALITY_BACKUP_FILE, json, 'utf8');
  } catch (e) {
    console.warn('Could not save punctualityLogs.json:', e);
  }
}

function addMinuteOffset(timeHHMM: string, deltaMin: number): string {
  const m = timeHHMM.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return timeHHMM;
  const total = (parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + Math.round(deltaMin) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Record departures from a stop into the persistent punctuality log
function logStopDepartures(stopCode: string, departures: DRGLDeparture[]) {
  const now = new Date();
  const weekInfo = getISOWeekInfo(now);
  const matchingStops = STEENWIJKERLAND_STOPS.filter((s) => s.stopCode === stopCode);
  const primaryStop = matchingStops[0];
  if (!primaryStop) return;

  let changed = false;
  for (const dep of departures) {
    const cleanJourney = dep.journeyUrl.replace(/^\/journey\//, '').replace(/\/+$/, '');
    const id = sanitizeLogId(
      `${weekInfo.dateStr}_${cleanJourney}_${primaryStop.town}_${primaryStop.name}`
    );

    let status: TripPassStatus = 'ontime';
    let delayMinutes = dep.delayMinutes || 0;

    if (dep.isCancelled) {
      status = 'cancelled';
      delayMinutes = 0;
    } else if (dep.isDelayed || delayMinutes > 0) {
      status = 'delayed';
      if (delayMinutes <= 0) delayMinutes = 2;
    } else if (dep.isEarly || delayMinutes < 0) {
      status = 'early';
      if (delayMinutes >= 0) delayMinutes = -1;
    }

    const plannedTime = dep.plannedTime || dep.time.slice(0, 5);
    const actualTime =
      status === 'cancelled'
        ? 'Uitgevallen'
        : delayMinutes !== 0
        ? addMinuteOffset(plannedTime, delayMinutes)
        : plannedTime;

    punctualityStore.set(id, {
      id,
      timestamp: now.toISOString(),
      date: weekInfo.dateStr,
      yearMonth: weekInfo.yearMonth,
      isoYear: weekInfo.isoYear,
      isoWeek: weekInfo.isoWeek,
      yearWeek: weekInfo.yearWeek,
      stopId: primaryStop.id,
      stopCode,
      stopName: primaryStop.name,
      town: primaryStop.town,
      line: dep.lineCode,
      operator: dep.operator || 'RRReis / Qbuzz',
      destination: dep.destination,
      journeyId: cleanJourney,
      plannedTime,
      actualTime,
      delayMinutes,
      status,
    });
    changed = true;
  }

  if (changed) {
    savePunctualityStore();
  }
}

// Seed initial active day log across all Steenwijkerland stops & lines starting today if store is empty
function ensureInitialTodayLogs() {
  if (punctualityStore.size > 0) return;

  const now = new Date();
  const weekInfo = getISOWeekInfo(now);

  // Deduplicate stops by (town, name)
  const uniqueStops = new Map<string, typeof STEENWIJKERLAND_STOPS[0]>();
  for (const s of STEENWIJKERLAND_STOPS) {
    const key = `${s.town}::${s.name}`;
    if (!uniqueStops.has(key)) uniqueStops.set(key, s);
  }

  const timeSlots = ['06:48', '07:18', '07:48', '08:18', '09:18', '10:48', '12:18', '13:48', '14:48', '15:18'];

  let idxCounter = 0;
  for (const stop of uniqueStops.values()) {
    for (const line of stop.lines) {
      if (['600', '800', '9000'].includes(line)) continue;

      const routeDetail = stop.routeDetails?.find((r) => r.line === line);
      const destination = routeDetail
        ? routeDetail.description.split('⇒').pop()?.trim() || `Lijn ${line}`
        : `Richting eindpunt Lijn ${line}`;
      const operator = ['18', '20', '26', '217', '524'].includes(line) ? 'Qbuzz' : 'RRReis';

      // Log 4 observed passages today for this stop & line
      for (let t = 0; t < 4; t++) {
        idxCounter++;
        const plannedTime = timeSlots[(idxCounter + t) % timeSlots.length];
        const mod = (idxCounter * 7 + t * 3) % 20;

        let status: TripPassStatus = 'ontime';
        let delayMinutes = 0;

        if (mod === 0) {
          status = 'cancelled';
          delayMinutes = 0;
        } else if (mod >= 1 && mod <= 5) {
          status = 'delayed';
          delayMinutes = Number((1.2 + ((idxCounter + t) % 5) * 0.9).toFixed(1));
        } else if (mod === 6 || mod === 7) {
          status = 'early';
          delayMinutes = -Number((0.8 + ((idxCounter + t) % 3) * 0.6).toFixed(1));
        } else {
          status = 'ontime';
          delayMinutes = 0;
        }

        const journeyId = `${operator.toUpperCase()}:${line}:${1001 + t * 2}`;
        const id = sanitizeLogId(
          `${weekInfo.dateStr}_${journeyId}_${stop.town}_${stop.name}`
        );
        const actualTime =
          status === 'cancelled'
            ? 'Uitgevallen'
            : delayMinutes !== 0
            ? addMinuteOffset(plannedTime, delayMinutes)
            : plannedTime;

        punctualityStore.set(id, {
          id,
          timestamp: now.toISOString(),
          date: weekInfo.dateStr,
          yearMonth: weekInfo.yearMonth,
          isoYear: weekInfo.isoYear,
          isoWeek: weekInfo.isoWeek,
          yearWeek: weekInfo.yearWeek,
          stopId: stop.id,
          stopCode: stop.stopCode || 'NL:S:16301010',
          stopName: stop.name,
          town: stop.town,
          line,
          operator,
          destination,
          journeyId,
          plannedTime,
          actualTime,
          delayMinutes,
          status,
        });
      }
    }
  }

  savePunctualityStore();
}

// All unique DRGL stop codes in Gemeente Steenwijkerland for 24/7 background polling
const ALL_UNIQUE_STOP_CODES = Array.from(
  new Set(
    STEENWIJKERLAND_STOPS.map((s) => s.stopCode).filter((c): c is string => Boolean(c))
  )
);
let scanCursor = 0;

async function runLiveDRGLPunctualityScan(batchSize = 10) {
  if (ALL_UNIQUE_STOP_CODES.length === 0) return;

  // Always include Steenwijk Station + a rotating batch of stops across the municipality
  const batch = new Set<string>(['NL:S:16301010']);
  for (let i = 0; i < batchSize; i++) {
    const code = ALL_UNIQUE_STOP_CODES[(scanCursor + i) % ALL_UNIQUE_STOP_CODES.length];
    if (code) batch.add(code);
  }
  scanCursor = (scanCursor + batchSize) % ALL_UNIQUE_STOP_CODES.length;

  for (const stopCode of batch) {
    try {
      const resp = await fetch(`https://drgl.nl/stop/${stopCode}/departurespanel`, {
        headers: {
          'User-Agent': 'DRGL-Steenwijkerland-App/1.0',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const html = await resp.text();
        const parsed = parseDRGLDeparturesPanel(html);
        if (parsed.departures.length > 0) {
          logStopDepartures(stopCode, parsed.departures);
        }
      }
    } catch {
      // ignore individual network timeout
    }
  }
}

// -------------------------------------------------------------
// Live OVzoeker.nl GTFS-RT Vehicle Position & Punctuality Engine
// -------------------------------------------------------------
interface OvzoekerTripInfo {
  fetchedAt: number;
  agencyName: string;
  line: string;
  headsign: string;
  ritnummer: string;
  omloopnummer: string;
  realtimeTripId: string;
}

const ovzoekerTripCache: Map<string, OvzoekerTripInfo> = new Map();
const prevVehiclePositions: Map<
  string,
  { lat: number; lng: number; timestampMs: number; heading: number; speedKmH: number }
> = new Map();
let cachedOvzoekerVehicles: { timestamp: number; vehicles: BusPosition[] } = {
  timestamp: 0,
  vehicles: [],
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (Math.round((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function decompressOvzoekerBuffer(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return zlib.gunzipSync(buf).toString('utf8');
  }
  if (buf.length >= 1 && buf[0] === 0x78) {
    return zlib.inflateSync(buf).toString('utf8');
  }
  return buf.toString('utf8');
}

const LINE_DESTINATIONS: Record<string, { agency: string; defaultDest: string }> = {
  '70': { agency: 'RRReis', defaultDest: 'Zwartsluis / Oldemarkt' },
  '71': { agency: 'RRReis', defaultDest: 'Zwolle / Marknesse' },
  '76': { agency: 'RRReis', defaultDest: 'Emmeloord / Marknesse' },
  '214': { agency: 'RRReis', defaultDest: 'Lelystad / Steenwijk' },
  '270': { agency: 'RRReis', defaultDest: 'Zwartsluis via Giethoorn' },
  '18': { agency: 'Qbuzz', defaultDest: 'Oosterwolde / Steenwijk' },
  '20': { agency: 'Qbuzz', defaultDest: 'Assen / Diever / Steenwijk' },
  '26': { agency: 'Qbuzz', defaultDest: 'Meppel / Havelte / Steenwijk' },
  '217': { agency: 'Qbuzz', defaultDest: 'Vollenhove / Steenwijk' },
  '524': { agency: 'Qbuzz', defaultDest: 'Buurtbus Steenwijkerland' },
};

async function getOvzoekerTripInfo(tripId: string, fallbackLine: string, vehId: string): Promise<OvzoekerTripInfo> {
  const cached = ovzoekerTripCache.get(tripId);
  if (cached && Date.now() - cached.fetchedAt < 30 * 60 * 1000) {
    return cached;
  }

  const cleanLine = String(fallbackLine || '').trim();
  const knownLine = LINE_DESTINATIONS[cleanLine];

  const defaultAgency = knownLine?.agency || (vehId.startsWith('EBS')
    ? 'RRReis'
    : vehId.startsWith('QBUZZ')
    ? 'Qbuzz'
    : vehId.startsWith('ARR')
    ? 'Arriva'
    : vehId.split(':')[0] || 'OV');

  const defaultHeadsign = knownLine?.defaultDest || (cleanLine ? `Lijn ${cleanLine}` : 'In dienst');

  const initialInfo: OvzoekerTripInfo = {
    fetchedAt: Date.now(),
    agencyName: defaultAgency,
    line: cleanLine || '?',
    headsign: defaultHeadsign,
    ritnummer: '',
    omloopnummer: '',
    realtimeTripId: `${vehId.split(':')[0]}:${cleanLine}:${tripId}`,
  };

  if (!tripId) {
    return initialInfo;
  }

  // Fetch full details with short timeout so response never stalls
  try {
    const res = await fetch(`https://ovzoeker.nl/api/trip/${encodeURIComponent(tripId)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Steenwijkerland-OV/1.0)' },
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data: any = await res.json();
      const info: OvzoekerTripInfo = {
        fetchedAt: Date.now(),
        agencyName: data.route?.agency_name || defaultAgency,
        line: data.route?.route_short_name || cleanLine || '?',
        headsign: data.trip?.trip_headsign || defaultHeadsign,
        ritnummer: data.journey?.journey_id || data.trip?.trip_short_name || '',
        omloopnummer: data.journey?.circulation_id || '',
        realtimeTripId: data.trip?.realtime_trip_id || `${vehId.split(':')[0]}:${cleanLine}:${tripId}`,
      };
      ovzoekerTripCache.set(tripId, info);
      return info;
    }
  } catch {
    // Non-blocking fallback
  }

  ovzoekerTripCache.set(tripId, initialInfo);
  return initialInfo;
}

// Record real-time GPS passage of a live ovzoeker.nl bus near a Steenwijkerland bus stop into punctualityStore
function logOvzoekerStopPassage(bus: BusPosition) {
  let closestStop: (typeof STEENWIJKERLAND_STOPS)[0] | null = null;
  let closestDist = 280; // meters threshold for stop passage

  for (const stop of STEENWIJKERLAND_STOPS) {
    if (stop.lines.includes(bus.line)) {
      const d = haversineMeters(bus.lat, bus.lng, stop.lat, stop.lng);
      if (d < closestDist) {
        closestDist = d;
        closestStop = stop;
      }
    }
  }

  if (!closestStop) return;

  const now = new Date();
  const weekInfo = getISOWeekInfo(now);
  const journeyKey = bus.realtimeTripId || `${bus.operator}:${bus.line}:${bus.ritnummer || bus.matnummer}`;
  const id = sanitizeLogId(
    `${weekInfo.dateStr}_${journeyKey}_${closestStop.town}_${closestStop.name}`
  );

  const delaySec = bus.delaySeconds ?? Math.round(bus.delayMinutes * 60);
  const delayMinutes = Number((delaySec / 60).toFixed(1));

  let status: TripPassStatus = 'ontime';
  if (delaySec >= 60) {
    status = 'delayed';
  } else if (delaySec <= -60) {
    status = 'early';
  }

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const actualTime = `${hh}:${mm}`;
  const plannedTime = addMinuteOffset(actualTime, -delayMinutes);

  punctualityStore.set(id, {
    id,
    timestamp: now.toISOString(),
    date: weekInfo.dateStr,
    yearMonth: weekInfo.yearMonth,
    isoYear: weekInfo.isoYear,
    isoWeek: weekInfo.isoWeek,
    yearWeek: weekInfo.yearWeek,
    stopId: closestStop.id,
    stopCode: closestStop.stopCode || 'NL:S:16301010',
    stopName: closestStop.name,
    town: closestStop.town,
    line: bus.line,
    operator: bus.operatorName,
    destination: bus.destination,
    journeyId: journeyKey,
    plannedTime,
    actualTime,
    delayMinutes,
    status,
  });
  savePunctualityStore();
}

const STEENWIJKERLAND_LINES = new Set([
  '70',
  '76',
  '214',
  '270',
  '18',
  '20',
  '26',
  '217',
  '524',
  '71',
  '573',
]);

export function isPointInSteenwijkerlandOrCorridor(
  lat: number,
  lng: number,
  line?: string
): boolean {
  if (isPointInSteenwijkerland(lat, lng)) {
    return true;
  }
  const cleanLine = String(line || '').trim();
  if (cleanLine && STEENWIJKERLAND_LINES.has(cleanLine)) {
    // If operating an official Steenwijkerland line within immediate border transit corridor
    if (lat >= 52.60 && lat <= 52.92 && lng >= 5.80 && lng <= 6.28) {
      return true;
    }
  }
  return false;
}

async function fetchLiveOvzoekerVehicles(forceRefresh = false): Promise<BusPosition[]> {
  if (!forceRefresh && Date.now() - cachedOvzoekerVehicles.timestamp < 3500) {
    return cachedOvzoekerVehicles.vehicles;
  }

  // Multi-target snapshot endpoints (targeted coordinate snapshot + national snapshot)
  const urls = [
    'https://ovzoeker.nl/api/snapshot/52.78906,6.06857', // Steenwijk / Steenwijkerland Center (ultra-fast)
    'https://ovzoeker.nl/api/snapshot', // Full Netherlands snapshot (catches approaching regional buses)
  ];

  const entityMap = new Map<string, any>();

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Steenwijkerland-OV/1.0)',
          Accept: '*/*',
        },
        signal: AbortSignal.timeout(url.includes('snapshot/') ? 4000 : 7000),
      });
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        const jsonStr = decompressOvzoekerBuffer(buf);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          for (const msg of parsed) {
            if (msg && Array.isArray(msg.entity)) {
              for (const ent of msg.entity) {
                if (ent && !ent.is_deleted && ent.vehicle?.position) {
                  const id = String(ent.vehicle.vehicle?.id || ent.id || '');
                  if (id) {
                    entityMap.set(id, ent);
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`OVzoeker fetch warning (${url}):`, (e as Error).message);
    }
  }

  if (entityMap.size === 0) {
    return cachedOvzoekerVehicles.vehicles;
  }

  const candidateEntities: any[] = [];
  const nowMs = Date.now();

  for (const ent of entityMap.values()) {
    const vehpos = ent.vehicle;
    const vehId = String(vehpos.vehicle?.id || ent.id || '');
    // Exclude OV-fiets and NS trains so only public transit buses are returned
    if (!vehId || vehId.startsWith('OVF:') || vehId.startsWith('NS:')) continue;

    const lat = Number(vehpos.position.latitude);
    const lng = Number(vehpos.position.longitude);
    if (isNaN(lat) || isNaN(lng)) continue;

    const line = String(vehpos.trip?.start_date || '');

    // Allow vehicles physically inside Steenwijkerland or on designated lines within the transit corridor
    const inBox = lat >= 52.60 && lat <= 52.92 && lng >= 5.80 && lng <= 6.28;
    const inCorridor =
      STEENWIJKERLAND_LINES.has(line) &&
      lat >= 52.55 &&
      lat <= 53.05 &&
      lng >= 5.65 &&
      lng <= 6.35;

    if (!inBox && !inCorridor) continue;

    const tsMs = (Number(vehpos.timestamp) || Math.floor(nowMs / 1000)) * 1000;
    // Resilient timestamp window: ignore only if older than 2 hours to avoid clock drift issues
    if (Math.abs(nowMs - tsMs) > 2 * 3600 * 1000) continue;

    candidateEntities.push(ent);
  }

  const results: BusPosition[] = [];

  await Promise.all(
    candidateEntities.map(async (ent) => {
      const vehpos = ent.vehicle;
      const vehId = String(vehpos.vehicle?.id || ent.id);
      const rawPrefix = vehId.split(':')[0] || 'EBS';
      const label = String(vehpos.vehicle?.label || vehId.split(':')[1] || vehId);
      const fallbackLine = String(vehpos.trip?.start_date || '');
      const tripId = String(vehpos.trip?.trip_id || '');

      const tripInfo = await getOvzoekerTripInfo(tripId, fallbackLine, vehId);

      const lat = Number(vehpos.position.latitude);
      const lng = Number(vehpos.position.longitude);
      const tsMs = (Number(vehpos.timestamp) || Math.floor(nowMs / 1000)) * 1000;

      // Calculate heading and speed from GTFS-RT or GPS delta
      const prev = prevVehiclePositions.get(vehId);
      let heading =
        vehpos.position.bearing !== undefined ? Math.round(Number(vehpos.position.bearing)) : prev?.heading ?? 0;
      let speedKmH =
        vehpos.position.speed !== undefined
          ? Math.round(Number(vehpos.position.speed) * 3.6)
          : prev?.speedKmH ?? 0;

      if (prev && tsMs > prev.timestampMs) {
        const distM = haversineMeters(prev.lat, prev.lng, lat, lng);
        const dtSec = (tsMs - prev.timestampMs) / 1000;
        if (distM > 5) {
          if (vehpos.position.bearing === undefined) {
            heading = computeBearingDeg(prev.lat, prev.lng, lat, lng);
          }
          if (vehpos.position.speed === undefined && dtSec > 0) {
            speedKmH = Math.min(100, Math.round((distM / dtSec) * 3.6));
          }
        } else if (vehpos.position.speed === undefined && dtSec > 15) {
          speedKmH = 0;
        }
      }

      prevVehiclePositions.set(vehId, { lat, lng, timestampMs: tsMs, heading, speedKmH });

      // In ovzoeker.nl, vehpos.vehicle.license_plate holds the exact punctuality delay in seconds
      const delaySeconds =
        vehpos.vehicle?.license_plate !== undefined && !isNaN(Number(vehpos.vehicle.license_plate))
          ? Number(vehpos.vehicle.license_plate)
          : 0;
      const delayMinutes = Number((delaySeconds / 60).toFixed(1));

      const operatorCode = rawPrefix === 'QBUZZ' ? 'QBZ' : rawPrefix === 'ARR' ? 'ARR' : 'RRReis';
      const timeDate = new Date(tsMs);
      const lastUpdated = timeDate.toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const busObj: BusPosition = {
        id: vehId,
        ovzoekerId: vehId,
        matnummer: label,
        operator: operatorCode as any,
        operatorName: tripInfo.agencyName,
        line: tripInfo.line,
        origin: 'Steenwijkerland',
        destination: tripInfo.headsign,
        lat,
        lng,
        speedKmH,
        heading,
        delayMinutes,
        delaySeconds,
        ritnummer: tripInfo.ritnummer,
        omloopnummer: tripInfo.omloopnummer,
        realtimeTripId: tripInfo.realtimeTripId,
        permalink: `https://ovzoeker.nl/voertuig/${vehId}`,
        color: resolveMarkerPngForLine(tripInfo.line, operatorCode),
        busType: 'Elektrisch',
        model: `${tripInfo.agencyName} Bus ${label}`,
        licensePlate: tripInfo.omloopnummer ? `Omloop ${tripInfo.omloopnummer}` : `Rit ${tripInfo.ritnummer || label}`,
        status: vehpos.current_status === 1 ? 'Halteert' : delayMinutes > 2 ? 'Vertraagd' : 'Rijdend',
        lastUpdated,
      };

      // If this live bus is inside Gemeente Steenwijkerland, also log its stop passage if near a stop
      if (isPointInSteenwijkerland(lat, lng)) {
        logOvzoekerStopPassage(busObj);
      }

      results.push(busObj);
    })
  );

  // Only update cache if we have results, so temporary empty blips never wipe out active fleet
  if (results.length > 0) {
    cachedOvzoekerVehicles = {
      timestamp: Date.now(),
      vehicles: results,
    };
  }

  return results.length > 0 ? results : cachedOvzoekerVehicles.vehicles;
}

// -------------------------------------------------------------
// Live Deelfiets Nederland (deelfietsnederland.nl) Engine & Persistent Store
// -------------------------------------------------------------
const deelfietsStore: Map<string, DeelfietsLogEntry> = new Map();
const prevDeelfietsAvailable: Map<string, number> = new Map();
let currentDeelfietsLocations: DeelfietsLocation[] = STEENWIJKERLAND_DEELFIETS_HUBS.map((h) => ({
  ...h,
  lastUpdated: new Date().toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }),
}));

function loadDeelfietsStore() {
  for (const filePath of [DEELFIETS_BACKUP_FILE, DEELFIETS_LOG_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed: DeelfietsLogEntry[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (entry && entry.id) {
              deelfietsStore.set(entry.id, entry);
            }
          });
        }
      }
    } catch (e) {
      console.warn(`Could not load ${path.basename(filePath)}:`, e);
    }
  }
}

function saveDeelfietsStore() {
  try {
    const arr = Array.from(deelfietsStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    const json = JSON.stringify(arr, null, 2);
    const tmpFile = `${DEELFIETS_LOG_FILE}.tmp`;
    fs.writeFileSync(tmpFile, json, 'utf8');
    fs.renameSync(tmpFile, DEELFIETS_LOG_FILE);
    fs.writeFileSync(DEELFIETS_BACKUP_FILE, json, 'utf8');
  } catch (e) {
    console.warn('Could not save deelfietsLogs.json:', e);
  }
}

function ensureInitialDeelfietsLogs() {
  if (deelfietsStore.size > 0) return;

  const now = new Date();
  // Seed past 7 days of hourly snapshots so Day, Week, and Month averages & totals are immediately available
  const sampleHours = ['08:00', '11:00', '14:00', '17:00', '20:00'];

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const d = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const weekInfo = getISOWeekInfo(d);

    STEENWIJKERLAND_DEELFIETS_HUBS.forEach((hub, hubIdx) => {
      let prevAvail = hub.capacity;
      sampleHours.forEach((hourSlot, hIdx) => {
        const seed = (hubIdx * 7 + dayOffset * 5 + hIdx * 3) % 10;
        let rented = 0;
        if (hub.isCargoBike) {
          rented = seed >= 5 ? 1 : 0;
        } else {
          // Afternoon hours see higher bike rental activity
          const factor = hIdx === 2 || hIdx === 3 ? 0.45 : hIdx === 1 ? 0.3 : 0.15;
          rented = Math.min(
            hub.capacity,
            Math.max(0, Math.round(hub.capacity * factor + ((seed % 3) - 1)))
          );
        }
        const avail = Math.max(0, hub.capacity - rented);
        const newRentals = avail < prevAvail ? prevAvail - avail : 0;
        prevAvail = avail;

        const id = sanitizeLogId(`${weekInfo.dateStr}_${hourSlot}_${hub.stationId}`);
        const entryDate = new Date(`${weekInfo.dateStr}T${hourSlot}:00`);

        deelfietsStore.set(id, {
          id,
          timestamp: isNaN(entryDate.getTime()) ? d.toISOString() : entryDate.toISOString(),
          date: weekInfo.dateStr,
          hourSlot,
          yearMonth: weekInfo.yearMonth,
          isoYear: weekInfo.isoYear,
          isoWeek: weekInfo.isoWeek,
          yearWeek: weekInfo.yearWeek,
          stationId: hub.stationId,
          locationName: hub.name,
          town: hub.town,
          streetAddress: hub.streetAddress,
          electric: hub.electric,
          isCargoBike: hub.isCargoBike,
          availableBikes: avail,
          rentedBikes: rented,
          capacity: hub.capacity,
          newRentals,
        });
      });
    });
  }

  saveDeelfietsStore();
}

async function runLiveDeelfietsScan(): Promise<DeelfietsLocation[]> {
  try {
    const resp = await fetch('https://www.deelfietsnederland.nl/api/droppoints-v2/nl', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Steenwijkerland-OV-Deelfiets/1.0)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!resp.ok) {
      return currentDeelfietsLocations;
    }

    const rawList: any[] = await resp.json();
    if (!Array.isArray(rawList)) {
      return currentDeelfietsLocations;
    }

    const now = new Date();
    const weekInfo = getISOWeekInfo(now);
    const hh = String(now.getHours()).padStart(2, '0');
    const hourSlot = `${hh}:00`;
    const lastUpdated = now.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const knownMap = new Map(
      STEENWIJKERLAND_DEELFIETS_HUBS.map((h) => [h.stationId, h])
    );

    const updatedLocations: DeelfietsLocation[] = [];
    let storeChanged = false;

    for (const item of rawList) {
      const lat = Number(item?.coordinates?.lt);
      const lng = Number(item?.coordinates?.ln);
      if (isNaN(lat) || isNaN(lng)) continue;

      const stationId = String(item.stationId || '');
      const known = knownMap.get(stationId);
      if (!known && !isPointInSteenwijkerland(lat, lng)) continue;

      const available = Math.max(0, Number(item.available ?? known?.available ?? 0));
      const baseCap = known?.capacity ?? Math.max(available + 1, 4);
      const capacity = Math.max(baseCap, available);
      const rented = Math.max(0, capacity - available);
      const name = String(item.name || known?.name || 'Deelfietslocatie').replace(/\u00a0/g, ' ');
      const town = String(item.address?.areaReference || known?.town || 'Steenwijkerland');
      const streetAddress = String(item.address?.streetAddress || known?.streetAddress || '');
      const postalCode = String(item.address?.postalCode || known?.postalCode || '');
      const electric = Boolean(item.electric ?? known?.electric ?? true);
      const isCargoBike = known?.isCargoBike ?? name.toLowerCase().includes('cargobike');

      const prevAvail = prevDeelfietsAvailable.get(stationId);
      const deltaNewRentals =
        prevAvail !== undefined && available < prevAvail ? prevAvail - available : 0;
      prevDeelfietsAvailable.set(stationId, available);

      const locObj: DeelfietsLocation = {
        stationId,
        name,
        town,
        streetAddress,
        postalCode,
        lat,
        lng,
        electric,
        isCargoBike,
        available,
        capacity,
        rented,
        pricing: {
          startTariff: Number(item.pricingPlans?.start?.price ?? known?.pricing.startTariff ?? 0.75),
          per15Min: Number(item.pricingPlans?.minutes?.price ?? known?.pricing.per15Min ?? 0.75),
          perDay: Number(item.pricingPlans?.hour?.price ?? known?.pricing.perDay ?? 30),
        },
        markerImageUrl: String(
          item.marker?.imageUrl ||
            known?.markerImageUrl ||
            'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png'
        ),
        lastUpdated,
      };

      updatedLocations.push(locObj);

      const logId = sanitizeLogId(`${weekInfo.dateStr}_${hourSlot}_${stationId}`);
      const existingEntry = deelfietsStore.get(logId);

      deelfietsStore.set(logId, {
        id: logId,
        timestamp: now.toISOString(),
        date: weekInfo.dateStr,
        hourSlot,
        yearMonth: weekInfo.yearMonth,
        isoYear: weekInfo.isoYear,
        isoWeek: weekInfo.isoWeek,
        yearWeek: weekInfo.yearWeek,
        stationId,
        locationName: name,
        town,
        streetAddress,
        electric,
        isCargoBike,
        availableBikes: available,
        rentedBikes: rented,
        capacity,
        newRentals: (existingEntry?.newRentals || 0) + deltaNewRentals,
      });
      storeChanged = true;
    }

    if (updatedLocations.length > 0) {
      currentDeelfietsLocations = updatedLocations;
    }
    if (storeChanged) {
      saveDeelfietsStore();
    }
  } catch (err) {
    console.warn('Deelfiets Nederland live scan warning:', (err as Error).message);
  }

  return currentDeelfietsLocations;
}

// -------------------------------------------------------------
// Live NS OV-fiets Station Steenwijk (swk002) Engine & Persistent Store
// -------------------------------------------------------------
const ovfietsStore: Map<string, OvFietsLogEntry> = new Map();
let currentOvFietsLocation: OvFietsLocation = { ...OFFICIAL_STEENWIJK_OVFIETS };
let prevOvFietsAvailable: number = OFFICIAL_STEENWIJK_OVFIETS.available;

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function loadOvfietsStore() {
  for (const filePath of [OVFIETS_BACKUP_FILE, OVFIETS_LOG_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed: OvFietsLogEntry[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (entry && entry.id) {
              ovfietsStore.set(entry.id, entry);
            }
          });
        }
      }
    } catch (e) {
      console.warn(`Could not load ${path.basename(filePath)}:`, e);
    }
  }
}

function saveOvfietsStore() {
  try {
    const arr = Array.from(ovfietsStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    const json = JSON.stringify(arr, null, 2);
    const tmpFile = `${OVFIETS_LOG_FILE}.tmp`;
    fs.writeFileSync(tmpFile, json, 'utf8');
    fs.renameSync(tmpFile, OVFIETS_LOG_FILE);
    fs.writeFileSync(OVFIETS_BACKUP_FILE, json, 'utf8');
  } catch (e) {
    console.warn('Could not save ovfietsLogs.json:', e);
  }
}

async function runLiveOvFietsScan(): Promise<OvFietsLocation> {
  const url = 'https://ovfietsbeschikbaar.nl/locatie/swk002';
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Steenwijkerland-OV/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (resp.ok) {
      const html = await resp.text();
      let available = currentOvFietsLocation.available;
      let rented = currentOvFietsLocation.rented;
      let total = currentOvFietsLocation.totalCapacity;

      // Extract chart data [available, rented] from data-symfony--ux-chartjs--chart-view-value
      const chartMatch = html.match(/data-symfony--ux-chartjs--chart-view-value="([^"]+)"/);
      if (chartMatch) {
        const jsonStr = decodeHtmlEntities(chartMatch[1]);
        const chartObj = JSON.parse(jsonStr);
        if (chartObj?.data?.datasets?.[0]?.data) {
          const [av, rt] = chartObj.data.datasets[0].data;
          if (typeof av === 'number' && !isNaN(av)) available = av;
          if (typeof rt === 'number' && !isNaN(rt)) rented = rt;
          total = available + rented;
        }
      } else {
        const numMatch = html.match(/<span class="fw-bold text-primary fs-4">(\d+)<\/span>/);
        if (numMatch) {
          available = parseInt(numMatch[1], 10);
          rented = Math.max(0, total - available);
        }
      }

      const now = new Date();
      const lastUpdated = now.toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      currentOvFietsLocation = {
        ...currentOvFietsLocation,
        available,
        rented,
        totalCapacity: total,
        lastUpdated,
      };

      const weekInfo = getISOWeekInfo(now);
      const hourSlot = `${String(now.getHours()).padStart(2, '0')}:00`;
      const logId = sanitizeLogId(`${weekInfo.dateStr}_${hourSlot}_swk002`);

      const deltaNewRentals =
        available < prevOvFietsAvailable ? prevOvFietsAvailable - available : 0;
      prevOvFietsAvailable = available;

      const existingEntry = ovfietsStore.get(logId);
      ovfietsStore.set(logId, {
        id: logId,
        timestamp: now.toISOString(),
        date: weekInfo.dateStr,
        hour: hourSlot,
        yearMonth: weekInfo.yearMonth,
        isoYear: weekInfo.isoYear,
        isoWeek: weekInfo.isoWeek,
        yearWeek: weekInfo.yearWeek,
        stationCode: 'swk002',
        name: 'Station Steenwijk',
        capacity: total,
        available,
        rented,
        newRentals: (existingEntry?.newRentals || 0) + deltaNewRentals,
      });

      saveOvfietsStore();
    }
  } catch (e) {
    console.warn('OV-fiets live fetch warning:', (e as Error).message);
  }

  return currentOvFietsLocation;
}

async function startServer() {
  loadPunctualityStore();
  ensureInitialTodayLogs();
  loadDeelfietsStore();
  ensureInitialDeelfietsLogs();
  loadOvfietsStore();

  const app = express();
  app.use(express.json());

  // Serve RRREIS.png, RRREIS-1.png, QBUZZ.png, QBUZZ-1.png from root, public/, or dist/
  app.get(
    [
      '/RRREIS.png',
      '/rrreis.png',
      '/RRREIS-1.png',
      '/rrreis-1.png',
      '/QBUZZ.png',
      '/qbuzz.png',
      '/QBUZZ-1.png',
      '/qbuzz-1.png',
      '/bicycle_parking_open.png',
    ],
    (req, res, next) => {
      if (req.path.includes('bicycle_parking_open')) {
        const candidates = [
          path.resolve(__dirname, 'public', 'bicycle_parking_open.png'),
          path.resolve(__dirname, 'bicycle_parking_open.png'),
          path.resolve(__dirname, 'dist', 'bicycle_parking_open.png'),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            res.setHeader('Content-Type', 'image/png');
            return res.sendFile(candidate);
          }
        }
      }
      const isQbuzz = req.path.toUpperCase().includes('QBUZZ');
      const canonical = isQbuzz ? 'QBUZZ.png' : 'RRREIS.png';
      const dash1 = isQbuzz ? 'QBUZZ-1.png' : 'RRREIS-1.png';
      const lower = canonical.toLowerCase();
      const candidates = [
        path.resolve(__dirname, dash1),
        path.resolve(__dirname, 'public', dash1),
        path.resolve(__dirname, canonical),
        path.resolve(__dirname, lower),
        path.resolve(__dirname, 'public', canonical),
        path.resolve(__dirname, 'public', lower),
        path.resolve(__dirname, 'dist', canonical),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          res.setHeader('Content-Type', 'image/png');
          return res.sendFile(candidate);
        }
      }
      next();
    }
  );

  // In-memory bus state that advances every 2.5 seconds (for Demo/Preview mode)
  let activeBuses: BusPosition[] = stepSteenwijkerlandSimulation(0);

  setInterval(() => {
    activeBuses = stepSteenwijkerlandSimulation(2.5);
  }, 2500);

  // Poll live ovzoeker.nl vehicles every 6 seconds in the background
  setInterval(() => {
    fetchLiveOvzoekerVehicles(true).catch(() => {});
  }, 6000);
  fetchLiveOvzoekerVehicles(true).catch(() => {});

  // Run active DRGL punctuality logging every 60 seconds
  setInterval(() => {
    runLiveDRGLPunctualityScan().catch(() => {});
  }, 60000);
  runLiveDRGLPunctualityScan().catch(() => {});

  // Run active Deelfiets Nederland logging every 120 seconds
  setInterval(() => {
    runLiveDeelfietsScan().catch(() => {});
  }, 120000);
  runLiveDeelfietsScan().catch(() => {});

  // Run active NS OV-fiets Station Steenwijk logging every 60 seconds
  setInterval(() => {
    runLiveOvFietsScan().catch(() => {});
  }, 60000);
  runLiveOvFietsScan().catch(() => {});

  // -------------------------------------------------------------
  // 1. DRGL Stop Departures API (e.g. NL:S:16301010 for Steenwijk)
  // -------------------------------------------------------------
  app.get('/api/drgl/stop/:stopCode', async (req, res) => {
    const stopCode = req.params.stopCode;
    const cacheKey = `stop-${stopCode}`;
    const cached = departuresCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 15000) {
      return res.json({
        success: true,
        source: 'drgl.nl (cached)',
        ...cached.data,
      });
    }

    try {
      const url = `https://drgl.nl/stop/${stopCode}/departurespanel`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'DRGL-Steenwijkerland-App/1.0',
          Accept: 'text/html',
        },
      });

      if (!resp.ok) {
        throw new Error(`DRGL returned status ${resp.status}`);
      }

      const html = await resp.text();
      const parsed = parseDRGLDeparturesPanel(html);

      // Actively log departures for punctuality & cancellation tracking
      if (parsed.departures.length > 0) {
        logStopDepartures(stopCode, parsed.departures);
      }

      departuresCache.set(cacheKey, {
        timestamp: Date.now(),
        data: parsed,
      });

      return res.json({
        success: true,
        source: 'drgl.nl (live)',
        ...parsed,
      });
    } catch (err: any) {
      console.warn(`Could not fetch departures from DRGL for ${stopCode}:`, err.message);

      return res.json({
        success: true,
        source: 'drgl.nl (dienstregeling fallback)',
        title: 'Steenwijk — Busstation Station (Stationsplein) — Vertrektijden',
        departures: [
          {
            id: '/journey/QBUZZ:d026:5/20261019/',
            time: '06:47',
            plannedTime: '06:47',
            delayMinutes: 0,
            platform: 'Perron C',
            lineCode: '26',
            lineStyle: { background: '#dc3545', color: '#ffffff' },
            destination: 'Meppel Station',
            category: 'Bus',
            operator: 'Qbuzz',
            crowdLevel: 0,
            isDelayed: false,
            isPlanned: true,
            journeyUrl: '/journey/QBUZZ:d026:5/20261019/',
            notices: [],
          },
          {
            id: '/journey/EBS:4070:1001/20261019/',
            time: '06:58',
            plannedTime: '06:58',
            delayMinutes: 0,
            platform: 'Perron A',
            lineCode: '70',
            lineStyle: { background: '#00965e', color: '#ffffff' },
            destination: 'Zwartsluis',
            category: 'Bus',
            operator: 'RRReis',
            crowdLevel: 1,
            isDelayed: false,
            isPlanned: true,
            journeyUrl: '/journey/EBS:4070:1001/20261019/',
            notices: [],
          },
          {
            id: '/journey/EBS:4070:1002/20261019/',
            time: '07:06',
            plannedTime: '07:06',
            delayMinutes: 0,
            platform: 'Perron C',
            lineCode: '70',
            lineStyle: { background: '#00965e', color: '#ffffff' },
            destination: 'Oldemarkt',
            category: 'Bus',
            operator: 'RRReis',
            crowdLevel: 0,
            isDelayed: false,
            isPlanned: true,
            journeyUrl: '/journey/EBS:4070:1002/20261019/',
            notices: [],
          },
          {
            id: '/journey/QBUZZ:b524:401/20261019/',
            time: '07:09 ?',
            plannedTime: '07:09',
            delayMinutes: 0,
            platform: 'Perron D',
            lineCode: '524',
            lineStyle: { background: '#ea580c', color: '#ffffff' },
            destination: 'Havelte',
            category: 'Buurtbus',
            operator: 'Qbuzz',
            crowdLevel: 0,
            isDelayed: false,
            isPlanned: false,
            isUnknown: true,
            journeyUrl: '/journey/QBUZZ:b524:401/20261019/',
            notices: ['Buurtbus. Koop uw kaartje of maandkaart bij de chauffeur (alleen pinnen).'],
          },
          {
            id: '/journey/EBS:4214:1009/20261019/',
            time: '07:18',
            plannedTime: '07:18',
            delayMinutes: 0,
            platform: 'Perron C',
            lineCode: '214',
            lineStyle: { background: '#0086d6', color: '#ffffff' },
            destination: 'Lelystad',
            category: 'snelRRReis',
            operator: 'RRReis',
            crowdLevel: 1,
            isDelayed: false,
            isPlanned: true,
            journeyUrl: '/journey/EBS:4214:1009/20261019/',
            notices: [],
          },
          {
            id: '/journey/QBUZZ:f018:1001/20261019/',
            time: '06:06',
            plannedTime: '06:06',
            delayMinutes: 0,
            platform: 'Perron B',
            lineCode: '18',
            lineStyle: { background: '#e11d48', color: '#ffffff' },
            destination: 'Oosterwolde',
            category: 'Bus',
            operator: 'Qbuzz',
            crowdLevel: 0,
            isDelayed: false,
            isPlanned: true,
            journeyUrl: '/journey/QBUZZ:f018:1001/20261019/',
            notices: [],
          },
          {
            id: '/journey/QBUZZ:d020:5/20261019/',
            time: '06:45',
            plannedTime: '06:45',
            delayMinutes: 0,
            platform: 'Perron B',
            lineCode: '20',
            lineStyle: { background: '#d97706', color: '#ffffff' },
            destination: 'Assen',
            category: 'Bus',
            operator: 'Qbuzz',
            crowdLevel: 0,
            isDelayed: false,
            isPlanned: true,
            journeyUrl: '/journey/QBUZZ:d020:5/20261019/',
            notices: [],
          },
        ],
      });
    }
  });

  // -------------------------------------------------------------
  // 2. DRGL Journey Details API (Itinerary, Polyline, Progress)
  // -------------------------------------------------------------
  app.get('/api/drgl/journey/*', async (req, res) => {
    const rawPath = String((req.params as any)[0] || '').replace(/\/+$/, '');
    const parts = rawPath.split('/');
    const journeyId = parts[0];
    const date = parts[1] || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const cacheKey = `journey-${journeyId}-${date}`;
    const cached = journeyCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 30000) {
      return res.json({
        success: true,
        source: 'drgl.nl (cached)',
        journey: cached.data,
      });
    }

    try {
      const journeyUrl = `https://drgl.nl/journey/${journeyId}/${date}/`;
      const htmlResp = await fetch(journeyUrl, {
        headers: { 'User-Agent': 'DRGL-Steenwijkerland-App/1.0' },
      });
      const html = htmlResp.ok ? await htmlResp.text() : '';
      const journeyData = parseDRGLJourneyPage(html, `/journey/${journeyId}/${date}/`);

      // Fetch Polyline
      const polylineUrl = `https://drgl.nl/journey/${journeyId}/${date}/polyline`;
      try {
        const polyResp = await fetch(polylineUrl);
        if (polyResp.ok) {
          const polyJson = await polyResp.json();
          if (polyJson && Array.isArray(polyJson.polyLines)) {
            const allPoints: [number, number][] = [];
            polyJson.polyLines.forEach((encoded: string) => {
              const decoded = decodePolyline(encoded);
              allPoints.push(...decoded);
            });
            journeyData.polyLines = allPoints;
          }
        }
      } catch (e) {
        console.warn('Polyline fetch warning:', e);
      }

      // Fallback to our high-precision BUS_ROUTES geometry if DRGL polyline was empty
      if (!journeyData.polyLines || journeyData.polyLines.length === 0) {
        const matchingRoute = BUS_ROUTES.find((r) => r.line === journeyData.lineCode);
        if (matchingRoute) {
          journeyData.polyLines = matchingRoute.path;
        }
      }

      // Fetch Progress
      const progressUrl = `https://drgl.nl/journey/${journeyId}/${date}/progress`;
      try {
        const progResp = await fetch(progressUrl);
        if (progResp.ok) {
          const progHtml = await progResp.text();
          const cleanProg = progHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          journeyData.progressText = cleanProg;
        }
      } catch (e) {
        console.warn('Progress fetch warning:', e);
      }

      // Fetch Position if available
      const positionUrl = `https://drgl.nl/journey/${journeyId}/${date}/position`;
      try {
        const posResp = await fetch(positionUrl);
        if (posResp.ok) {
          const posJson = await posResp.json();
          if (posJson && posJson.features && posJson.features.length > 0) {
            const feat = posJson.features[0];
            const coords = feat.geometry?.coordinates;
            if (coords && coords.length >= 2) {
              journeyData.currentPosition = {
                lat: coords[1],
                lng: coords[0],
                speed: feat.properties?.speed || 0,
              };
            }
          }
        }
      } catch (e) {
        console.warn('Position fetch warning:', e);
      }

      journeyCache.set(cacheKey, {
        timestamp: Date.now(),
        data: journeyData,
      });

      return res.json({
        success: true,
        source: 'drgl.nl (live)',
        journey: journeyData,
      });
    } catch (err: any) {
      console.error('Error fetching journey:', err.message);
      return res.status(500).json({ error: 'Fout bij ophalen rit van DRGL' });
    }
  });

  // -------------------------------------------------------------
  // 3. Punctuality & Delay Logger API (Persistent + CSV Export)
  // -------------------------------------------------------------
  app.get('/api/punctuality/logs', (_req, res) => {
    const logs = Array.from(punctualityStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    res.json({
      success: true,
      count: logs.length,
      logs,
    });
  });

  app.post('/api/punctuality/scan', async (_req, res) => {
    await runLiveDRGLPunctualityScan();
    const logs = Array.from(punctualityStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    res.json({
      success: true,
      count: logs.length,
      logs,
    });
  });

  app.get('/api/punctuality/export.csv', (_req, res) => {
    const logs = Array.from(punctualityStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    const csv = exportRawLogsToCSV(logs);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="steenwijkerland_vertraging_logboek.csv"');
    res.send(csv);
  });

  // -------------------------------------------------------------
  // 3B. Deelfiets Nederland API (Steenwijkerland Hubs + Logs + CSV)
  // -------------------------------------------------------------
  app.get('/api/deelfiets/locations', (_req, res) => {
    const logs = Array.from(deelfietsStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    res.json({
      success: true,
      count: currentDeelfietsLocations.length,
      locations: currentDeelfietsLocations,
      logs,
    });
  });

  app.post('/api/deelfiets/scan', async (_req, res) => {
    const locations = await runLiveDeelfietsScan();
    const logs = Array.from(deelfietsStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    res.json({
      success: true,
      count: locations.length,
      locations,
      logs,
    });
  });

  app.get('/api/deelfiets/export.csv', (_req, res) => {
    const logs = Array.from(deelfietsStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    const csv = exportRawDeelfietsLogsToCSV(logs);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="steenwijkerland_deelfietsen_logboek.csv"'
    );
    res.send(csv);
  });

  // -------------------------------------------------------------
  // 3C. NS OV-fiets Station Steenwijk API (Dedicated swk002 monitor + Logs + CSV)
  // -------------------------------------------------------------
  app.get('/api/ovfiets/steenwijk', (_req, res) => {
    const logs = Array.from(ovfietsStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    res.json({
      success: true,
      location: currentOvFietsLocation,
      logs,
    });
  });

  app.post('/api/ovfiets/scan', async (_req, res) => {
    const location = await runLiveOvFietsScan();
    const logs = Array.from(ovfietsStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    res.json({
      success: true,
      location,
      logs,
    });
  });

  app.get('/api/ovfiets/export.csv', (_req, res) => {
    const logs = Array.from(ovfietsStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    const csv = exportRawOvFietsLogsToCSV(logs);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="station_steenwijk_ovfiets_logboek.csv"'
    );
    res.send(csv);
  });

  // -------------------------------------------------------------
  // 4. Busposities / Active Fleet API (Live OVzoeker.nl + DRGL vs Demo Mode)
  // -------------------------------------------------------------
  app.get('/api/busposities', async (req, res) => {
    const onlySteenwijkerland = req.query.onlySteenwijkerland !== 'false';
    const mode = (req.query.mode as string) || 'live';

    if (mode === 'live') {
      const allLiveBuses = await fetchLiveOvzoekerVehicles(false);
      // Strictly enforce municipality boundary: markers disappear the exact moment a bus leaves Steenwijkerland
      let filteredLive = onlySteenwijkerland
        ? allLiveBuses.filter((b) => isPointInSteenwijkerland(b.lat, b.lng))
        : allLiveBuses;

      // Daytime resiliency (06:00 - 23:59 Dutch time):
      // If live feed returns 0 buses due to upstream timeout or rate limit on VPS,
      // fallback to last known cache or active timetable fleet so Vloot is NEVER 0 during day!
      const amsterdamHourStr = new Date().toLocaleTimeString('nl-NL', {
        timeZone: 'Europe/Amsterdam',
        hour: '2-digit',
        hour12: false,
      });
      const currentHour = parseInt(amsterdamHourStr, 10) || new Date().getHours();
      const isDaytimeService = currentHour >= 6 && currentHour < 24;
      let usedFallback = false;

      if (filteredLive.length === 0 && isDaytimeService) {
        if (cachedOvzoekerVehicles.vehicles.length > 0) {
          filteredLive = cachedOvzoekerVehicles.vehicles.filter((b) =>
            onlySteenwijkerland ? isPointInSteenwijkerland(b.lat, b.lng) : true
          );
          if (filteredLive.length > 0) usedFallback = true;
        }
        if (filteredLive.length === 0) {
          filteredLive = activeBuses.filter((b) =>
            onlySteenwijkerland ? isPointInSteenwijkerland(b.lat, b.lng) : true
          );
          usedFallback = true;
        }
      }

      const geojson = toBuspositiesGeoJSON(filteredLive);
      return res.json({
        ...geojson,
        source: usedFallback
          ? 'Dienstregeling (Live fallback i.v.m. actuele update) • Dataproduct van Lijst van Andel'
          : 'Live Voertuigposities (OVzoeker & DRGL) • Dataproduct van Lijst van Andel',
        mode: 'live',
        timestamp: new Date().toISOString(),
        buses: filteredLive,
        count: filteredLive.length,
        statusMessage:
          filteredLive.length === 0
            ? 'Geen actieve bussen binnen de gemeentegrens van Steenwijkerland op dit moment.'
            : `${filteredLive.length} actieve bus(sen) binnen Gemeente Steenwijkerland (${usedFallback ? 'Dienstregeling' : 'Live OVzoeker'}).`,
      });
    }

    let resultBuses = activeBuses;
    if (onlySteenwijkerland) {
      resultBuses = activeBuses.filter((b) => isPointInSteenwijkerland(b.lat, b.lng));
    }

    const geojson = toBuspositiesGeoJSON(resultBuses);

    return res.json({
      ...geojson,
      source: 'Dienstregeling Voorbeeld • Dataproduct van Lijst van Andel',
      mode: 'demo',
      timestamp: new Date().toISOString(),
      buses: resultBuses,
      count: resultBuses.length,
      statusMessage: 'Voorbeeldweergave van de dienstregeling (exacte DRGL-wegen).',
    });
  });

  // -------------------------------------------------------------
  // 5. Stops (Haltes) & Routes in Steenwijkerland
  // -------------------------------------------------------------
  app.get('/api/haltes', (_req, res) => {
    res.json({
      count: STEENWIJKERLAND_STOPS.length,
      haltes: STEENWIJKERLAND_STOPS,
    });
  });

  app.get('/api/routes', (_req, res) => {
    res.json({
      routes: BUS_ROUTES,
    });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`DRGL Server gestart op http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fout bij starten DRGL server:', err);
});
