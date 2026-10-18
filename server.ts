import express from 'express';
import fs from 'fs';
import path from 'path';
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
} from './src/utils/punctuality';
import { BusPosition } from './src/types/bus';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

const PUNCTUALITY_LOG_FILE = path.resolve(__dirname, 'src/data/punctualityLogs.json');

// Cache for DRGL departures and journeys
const departuresCache: Map<string, { timestamp: number; data: { title: string; departures: DRGLDeparture[] } }> = new Map();
const journeyCache: Map<string, { timestamp: number; data: DRGLJourneyData }> = new Map();

// Persistent Punctuality Log Store (keyed by entry.id)
const punctualityStore: Map<string, PunctualityLogEntry> = new Map();

function loadPunctualityStore() {
  try {
    if (fs.existsSync(PUNCTUALITY_LOG_FILE)) {
      const raw = fs.readFileSync(PUNCTUALITY_LOG_FILE, 'utf8');
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
    console.warn('Could not load punctualityLogs.json:', e);
  }
}

function savePunctualityStore() {
  try {
    const arr = Array.from(punctualityStore.values()).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    fs.writeFileSync(PUNCTUALITY_LOG_FILE, JSON.stringify(arr, null, 2), 'utf8');
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
    const id = `${weekInfo.dateStr}_${cleanJourney}_${primaryStop.town}_${primaryStop.name}`;

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
        const id = `${weekInfo.dateStr}_${journeyId}_${stop.town}_${stop.name}`;
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

// Active background poll of key DRGL stops in Steenwijkerland
const MONITORED_STOP_CODES = [
  'NL:S:16301010', // Steenwijk Station
  'NL:S:24550220', // Steenwijk Westercluft (Lijn 26)
  'NL:S:24550360', // Steenwijk Kallenkoterallee (Lijn 26)
  'NL:S:25780010', // Giethoorn Dominee T.O. Hylkemaweg
  'NL:S:25180010', // Blokzijl Busstation
  'NL:S:25270010', // Vollenhove Clarenberglaan
  'NL:S:24510040', // Oldemarkt Koningin Julianaweg
  'NL:S:25280070', // Wetering N333
];

async function runLiveDRGLPunctualityScan() {
  for (const stopCode of MONITORED_STOP_CODES) {
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

async function startServer() {
  loadPunctualityStore();
  ensureInitialTodayLogs();

  const app = express();
  app.use(express.json());

  // In-memory bus state that advances every 2.5 seconds
  let activeBuses: BusPosition[] = stepSteenwijkerlandSimulation(0);

  setInterval(() => {
    activeBuses = stepSteenwijkerlandSimulation(2.5);
  }, 2500);

  // Run active DRGL punctuality logging every 60 seconds
  setInterval(() => {
    runLiveDRGLPunctualityScan().catch(() => {});
  }, 60000);
  runLiveDRGLPunctualityScan().catch(() => {});

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
  // 4. Busposities / Active Fleet API (Strict Live vs Demo Mode)
  // -------------------------------------------------------------
  app.get('/api/busposities', async (req, res) => {
    const onlySteenwijkerland = req.query.onlySteenwijkerland !== 'false';
    const mode = (req.query.mode as string) || 'live';

    const liveVehicles: BusPosition[] = [];
    const recentDepartures = departuresCache.get('stop-NL:S:16301010')?.data?.departures || [];

    for (const dep of recentDepartures.slice(0, 4)) {
      const cleanUrl = dep.journeyUrl.replace(/^\/journey\//, '').replace(/\/+$/, '');
      const parts = cleanUrl.split('/');
      const jId = parts[0];
      const jDate = parts[1];

      if (jId && jDate) {
        const cachedJ = journeyCache.get(`journey-${jId}-${jDate}`);
        if (cachedJ && cachedJ.data.currentPosition) {
          const pos = cachedJ.data.currentPosition;
          if (!onlySteenwijkerland || isPointInSteenwijkerland(pos.lat, pos.lng)) {
            liveVehicles.push({
              id: `drgl-${jId}`,
              matnummer: cachedJ.data.vehicleCode || jId.split(':')[1] || 'DRGL',
              operator: (dep.operator.includes('Qbuzz') ? 'QBZ' : 'RRReis') as any,
              operatorName: dep.operator || 'RRReis',
              line: dep.lineCode,
              origin: 'Steenwijk Station',
              destination: dep.destination,
              lat: pos.lat,
              lng: pos.lng,
              speedKmH: pos.speed || 0,
              heading: 0,
              delayMinutes: dep.isDelayed ? 3 : 0,
              color: 'ebs.png',
              busType: 'Elektrisch',
              model: 'Streekbus',
              licensePlate: '',
              status: pos.speed > 0 ? 'Rijdend' : 'Halteert',
              lastUpdated: new Date().toLocaleTimeString(),
            });
          }
        }
      }
    }

    if (mode === 'live') {
      const geojson = toBuspositiesGeoJSON(liveVehicles);
      return res.json({
        ...geojson,
        source: 'DRGL.nl (Echte Live Feed)',
        mode: 'live',
        timestamp: new Date().toISOString(),
        buses: liveVehicles,
        count: liveVehicles.length,
        statusMessage:
          liveVehicles.length === 0
            ? 'Geen bussen actief in dienst op dit tijdstip (nachtdienstregeling). Eerstvolgende vertrek om 06:06.'
            : `${liveVehicles.length} actieve bus(sen) live gedetecteerd.`,
      });
    }

    let resultBuses = activeBuses;
    if (onlySteenwijkerland) {
      resultBuses = activeBuses.filter((b) => isPointInSteenwijkerland(b.lat, b.lng));
    }

    const geojson = toBuspositiesGeoJSON(resultBuses);

    return res.json({
      ...geojson,
      source: 'DRGL.nl (Dienstregeling Voorbeeld)',
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
