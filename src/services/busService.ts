import {
  BusPosition,
  BuspositiesGeoJSONResponse,
  BuspositiesGeoJSONFeature,
} from '../types/bus';
import {
  BUS_ROUTES,
  STEENWIJKERLAND_STOPS,
  isPointInSteenwijkerland,
} from '../data/steenwijkerland';

// Helper to get route path clipped to Gemeente Steenwijkerland so fleet vehicles stay within the municipality
function getRoutePath(line: string): [number, number][] {
  const found = BUS_ROUTES.find((r) => r.line === line);
  if (!found || found.path.length < 2) {
    return [
      [52.79056, 6.11800],
      [52.78539, 6.13210],
    ];
  }
  const inside = found.path.filter(([lat, lng]) => isPointInSteenwijkerland(lat, lng));
  return inside.length >= 5 ? inside : found.path;
}

// Realistic fleet operating on the exact Steenwijkerland routes (including Lijn 26 richting Meppel)
const INITIAL_SIM_BUSES: Omit<BusPosition, 'lat' | 'lng' | 'heading' | 'lastUpdated'>[] = [
  {
    id: 'qbz-7412',
    matnummer: '7412',
    operator: 'QBZ',
    operatorName: 'Qbuzz GD',
    line: '26',
    origin: 'Steenwijk Station',
    destination: 'Meppel Station',
    speedKmH: 54,
    delayMinutes: 0,
    color: 'arriva.png',
    busType: 'Elektrisch',
    model: 'Yutong E12 Elektrisch',
    licensePlate: 'BZN-26-K',
    status: 'Rijdend',
    nextStop: 'Kallenkoterallee, Steenwijk',
    occupancyPercent: 42,
  },
  {
    id: 'ebs-2084',
    matnummer: '2084',
    operator: 'RRReis',
    operatorName: 'EBS / RRReis IJssel-Vecht',
    line: '70',
    origin: 'Steenwijk Station',
    destination: 'Zwartsluis Busstation',
    speedKmH: 52,
    delayMinutes: 0,
    color: 'ebs.png',
    busType: 'Elektrisch',
    model: 'BYD eBus B12 12m',
    licensePlate: 'BZK-84-R',
    status: 'Rijdend',
    nextStop: 'Dominee T.O. Hylkemaweg, Giethoorn',
    occupancyPercent: 45,
  },
  {
    id: 'ebs-2119',
    matnummer: '2119',
    operator: 'RRReis',
    operatorName: 'EBS / RRReis IJssel-Vecht',
    line: '70',
    origin: 'Zwartsluis Busstation',
    destination: 'Oldemarkt Kon. Julianaweg',
    speedKmH: 48,
    delayMinutes: 1,
    color: 'ebs.png',
    busType: 'Elektrisch',
    model: 'BYD eBus B12 12m',
    licensePlate: 'BZK-19-S',
    status: 'Rijdend',
    nextStop: 'Gemeentewerken, Tuk',
    occupancyPercent: 30,
  },
  {
    id: 'ebs-4214',
    matnummer: '4214',
    operator: 'RRReis',
    operatorName: 'snelRRReis / EBS',
    line: '214',
    origin: 'Steenwijk Station',
    destination: 'Lelystad via Blokzijl',
    speedKmH: 64,
    delayMinutes: 0,
    color: 'ebs.png',
    busType: 'Elektrisch',
    model: 'Mercedes-Benz eCitaro G',
    licensePlate: 'BZN-14-X',
    status: 'Rijdend',
    nextStop: 'Steenwijkerweg N333, Wetering',
    occupancyPercent: 58,
  },
  {
    id: 'qbz-7308',
    matnummer: '7308',
    operator: 'QBZ',
    operatorName: 'Qbuzz Fryslân',
    line: '18',
    origin: 'Steenwijk Station',
    destination: 'Oosterwolde Busstation',
    speedKmH: 58,
    delayMinutes: 0,
    color: 'arriva.png',
    busType: 'Elektrisch',
    model: 'Iveco Crossway LE Elec',
    licensePlate: 'BZP-08-T',
    status: 'Rijdend',
    nextStop: 'Hooilanden, Eesveen',
    occupancyPercent: 32,
  },
  {
    id: 'qbz-3420',
    matnummer: '3420',
    operator: 'QBZ',
    operatorName: 'Qbuzz GD',
    line: '20',
    origin: 'Steenwijk Station',
    destination: 'Assen Station',
    speedKmH: 62,
    delayMinutes: 2,
    color: 'arriva.png',
    busType: 'Elektrisch',
    model: 'Mercedes-Benz Citaro C2',
    licensePlate: 'BZR-20-L',
    status: 'Rijdend',
    nextStop: 'De Eese, Eesveen',
    occupancyPercent: 40,
  },
  {
    id: 'qbz-7524',
    matnummer: '7524',
    operator: 'QBZ',
    operatorName: 'Qbuzz Buurtbus',
    line: '524',
    origin: 'Steenwijk Station',
    destination: 'Havelte Centrum',
    speedKmH: 45,
    delayMinutes: 0,
    color: 'ovcn.png',
    busType: 'Elektrisch',
    model: 'Mercedes-Benz Sprinter City',
    licensePlate: 'V-524-BB',
    status: 'Rijdend',
    nextStop: 'Bedelaarspad, Steenwijk',
    occupancyPercent: 20,
  },
  {
    id: 'ebs-2071',
    matnummer: '2071',
    operator: 'RRReis',
    operatorName: 'EBS / RRReis IJssel-Vecht',
    line: '71',
    origin: 'Zwolle Station',
    destination: 'Vollenhove / Emmeloord',
    speedKmH: 50,
    delayMinutes: 0,
    color: 'ebs.png',
    busType: 'Elektrisch',
    model: 'BYD eBus B12 12m',
    licensePlate: 'BZK-71-V',
    status: 'Rijdend',
    nextStop: 'Clarenberglaan, Vollenhove',
    occupancyPercent: 36,
  },
];

interface SimBusState {
  bus: Omit<BusPosition, 'lat' | 'lng' | 'heading' | 'lastUpdated'>;
  path: [number, number][];
  pointIdx: number;
  direction: 1 | -1;
}

const simStates: SimBusState[] = INITIAL_SIM_BUSES.map((bus, idx) => {
  const path = getRoutePath(bus.line);
  const startRatio = (idx * 0.17 + 0.12) % 0.85;
  const pointIdx = Math.max(0, Math.min(path.length - 2, Math.floor(path.length * startRatio)));

  return {
    bus,
    path,
    pointIdx,
    direction: idx % 2 === 0 ? 1 : -1,
  };
});

function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function stepSteenwijkerlandSimulation(_deltaSeconds: number): BusPosition[] {
  const nowStr = new Date().toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return simStates.map((st) => {
    const path = st.path;
    const len = path.length;

    let nextIdx = st.pointIdx + st.direction;
    if (nextIdx >= len) {
      st.direction = -1;
      nextIdx = Math.max(0, len - 2);
      const tmp = st.bus.origin;
      st.bus.origin = st.bus.destination;
      st.bus.destination = tmp;
    } else if (nextIdx < 0) {
      st.direction = 1;
      nextIdx = Math.min(len - 1, 1);
      const tmp = st.bus.origin;
      st.bus.origin = st.bus.destination;
      st.bus.destination = tmp;
    }

    const p1 = path[st.pointIdx] || path[0];
    const p2 = path[nextIdx] || p1;

    st.pointIdx = nextIdx;

    const heading = Math.round(calculateBearing(p1[0], p1[1], p2[0], p2[1]));

    // Nearest stop on this line (showing both Haltenaam and Plaats)
    let closestStop = st.bus.nextStop;
    let minD = 999;
    for (const s of STEENWIJKERLAND_STOPS) {
      if (s.lines.includes(st.bus.line)) {
        const d = Math.hypot(s.lat - p2[0], s.lng - p2[1]);
        if (d < minD) {
          minD = d;
          closestStop = `${s.name}, ${s.town}`;
        }
      }
    }

    const isAtStop = minD < 0.0012;
    const speed = isAtStop ? 0 : st.bus.speedKmH;
    const status = isAtStop
      ? 'Halteert'
      : st.bus.delayMinutes > 1
      ? 'Vertraagd'
      : 'Rijdend';

    return {
      ...st.bus,
      lat: Number(p2[0].toFixed(6)),
      lng: Number(p2[1].toFixed(6)),
      heading,
      speedKmH: speed,
      status,
      nextStop: closestStop,
      lastUpdated: nowStr,
    };
  });
}

export function toBuspositiesGeoJSON(buses: BusPosition[]): BuspositiesGeoJSONResponse {
  const features: BuspositiesGeoJSONFeature[] = buses.map((b) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [b.lat, b.lng],
    },
    properties: {
      matnummer: b.matnummer,
      color: b.color,
      richting: b.heading,
      line: b.line,
      operator: b.operator,
      destination: b.destination,
      speed: b.speedKmH,
      delay: b.delayMinutes,
      meerinfo: `<b>Lijn ${b.line} richting ${b.destination}</b><br/>Voertuig: ${b.matnummer} (${b.operatorName})<br/>Model: ${b.model}<br/>Snelheid: ${b.speedKmH} km/u`,
    },
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
}
