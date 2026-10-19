import { getISOWeekInfo } from './punctuality';

export interface DeelfietsPricing {
  startTariff: number;
  per15Min: number;
  perDay: number;
}

export interface DeelfietsLocation {
  stationId: string;
  name: string;
  town: string;
  streetAddress: string;
  postalCode: string;
  lat: number;
  lng: number;
  electric: boolean;
  isCargoBike: boolean;
  available: number;
  capacity: number;
  rented: number;
  pricing: DeelfietsPricing;
  markerImageUrl: string;
  lastUpdated: string;
}

export interface DeelfietsLogEntry {
  id: string; // e.g. "2026-10-19_10_feed3c0e-542d-45a1-b1a3-652f358b1b11"
  timestamp: string;
  date: string; // "YYYY-MM-DD"
  hourSlot: string; // "HH:00"
  yearMonth: string; // "YYYY-MM"
  isoYear: number;
  isoWeek: number;
  yearWeek: string; // "YYYY-Www"
  stationId: string;
  locationName: string;
  town: string;
  streetAddress: string;
  electric: boolean;
  isCargoBike: boolean;
  availableBikes: number;
  rentedBikes: number;
  capacity: number;
  newRentals: number; // number of new rental checkouts observed in this slot
}

export interface DeelfietsPeriodStats {
  stationId: string;
  locationName: string;
  town: string;
  streetAddress: string;
  electric: boolean;
  isCargoBike: boolean;
  periodLabel: string;
  sampleCount: number;
  daysCovered: number;
  currentAvailable: number;
  currentRented: number;
  capacity: number;
  // Averages & totals for the selected period (Day, Week, or Month)
  avgAvailableBikes: number;
  avgRentedBikes: number;
  totalRentedBikes: number;
  // Explicit Day / Week / Month breakdown for this location
  avgAvailableDay: number;
  avgAvailableWeek: number;
  avgAvailableMonth: number;
  avgRentedDay: number;
  avgRentedWeek: number;
  avgRentedMonth: number;
  totalRentedDay: number;
  totalRentedWeek: number;
  totalRentedMonth: number;
}

// Official 17 Deelfiets Nederland locations inside Gemeente Steenwijkerland (from deelfietsnederland.nl/api/droppoints-v2/nl)
export const STEENWIJKERLAND_DEELFIETS_HUBS: Omit<
  DeelfietsLocation,
  'lastUpdated'
>[] = [
  {
    stationId: 'feed3c0e-542d-45a1-b1a3-652f358b1b11',
    name: 'Station Steenwijk',
    town: 'Steenwijk',
    streetAddress: 'Stationsplein 2',
    postalCode: '8331 GM',
    lat: 52.790699,
    lng: 6.117868,
    electric: true,
    isCargoBike: false,
    available: 9,
    capacity: 12,
    rented: 3,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: 'cc01cb37-35d7-4818-b1bd-bcaa037b8ec0',
    name: 'Giethoorn Eendrachtsplein',
    town: 'Giethoorn',
    streetAddress: 'Dominee T.O. Hylkemaweg 1a',
    postalCode: '8355 DL',
    lat: 52.72165729,
    lng: 6.0787873,
    electric: true,
    isCargoBike: false,
    available: 11,
    capacity: 14,
    rented: 3,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: 'd30709aa-a968-4550-8f0f-3cee6f5352b2',
    name: 'Oldemarkt',
    town: 'Oldemarkt',
    streetAddress: 'Frieseweg 39',
    postalCode: '8375 AD',
    lat: 52.82141242,
    lng: 5.98239329,
    electric: true,
    isCargoBike: false,
    available: 4,
    capacity: 6,
    rented: 2,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: 'fe49dc5c-f73c-488e-b1e7-455b09570792',
    name: 'Blokzijl',
    town: 'Blokzijl',
    streetAddress: 'Kanaalweg 2',
    postalCode: '8356 VS',
    lat: 52.726796,
    lng: 5.955912,
    electric: true,
    isCargoBike: false,
    available: 5,
    capacity: 6,
    rented: 1,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: '1ee0d4e2-4354-40d0-b809-03dee998c0db',
    name: 'Snackbar vd Belt',
    town: 'Belt-Schutsloot',
    streetAddress: 'Belterweg 15a',
    postalCode: '8066 PP',
    lat: 52.66792026,
    lng: 6.05638932,
    electric: true,
    isCargoBike: false,
    available: 4,
    capacity: 5,
    rented: 1,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: '8a0010e8-e1dd-40d0-961d-4cf2af19a97d',
    name: 'NWG Koematen',
    town: 'Steenwijk',
    streetAddress: 'Koematen 32',
    postalCode: '8331 TK',
    lat: 52.78138,
    lng: 6.095414,
    electric: true,
    isCargoBike: false,
    available: 6,
    capacity: 6,
    rented: 0,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: 'ae445d48-c7cb-45ab-9c6a-b1c4b8506c94',
    name: 'Waterstaete Ossenzijl',
    town: 'Ossenzijl',
    streetAddress: 'Ossenzijlerweg',
    postalCode: '8376 HL',
    lat: 52.809722,
    lng: 5.92093,
    electric: true,
    isCargoBike: false,
    available: 4,
    capacity: 6,
    rented: 2,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: '98e41150-3db0-483e-bf64-11626b6fa615',
    name: 'Camping Aan het Wiede Wanneperveen',
    town: 'Wanneperveen',
    streetAddress: 'Veneweg 247',
    postalCode: '7946 LV',
    lat: 52.69436634,
    lng: 6.08497287,
    electric: true,
    isCargoBike: false,
    available: 4,
    capacity: 6,
    rented: 2,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: 'bd7dc8b8-5a90-48f1-b19f-53dfb1bf4433',
    name: 'Gemeentehuis Steenwijkerland',
    town: 'Steenwijk',
    streetAddress: 'Vendelweg 1',
    postalCode: '8331 XE',
    lat: 52.782947,
    lng: 6.116584,
    electric: true,
    isCargoBike: false,
    available: 0,
    capacity: 4,
    rented: 4,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_unavailable_ebike_77759c6c2d.png',
  },
  {
    stationId: 'dba6e913-c1a8-4c61-a6a8-341f02469555',
    name: 'Vollenhove',
    town: 'Vollenhove',
    streetAddress: 'Haven 2',
    postalCode: '8325 XE',
    lat: 52.683064,
    lng: 5.948186,
    electric: true,
    isCargoBike: false,
    available: 3,
    capacity: 5,
    rented: 2,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: '2d09419d-99c8-4919-bcde-4469252fbfca',
    name: 'Steenwijkerwold',
    town: 'Steenwijkerwold',
    streetAddress: 'Oldemarktseweg 117',
    postalCode: '8341 SC',
    lat: 52.804231,
    lng: 6.065845,
    electric: true,
    isCargoBike: false,
    available: 5,
    capacity: 6,
    rented: 1,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: 'e774661d-e2f6-4f22-a2aa-938391967b7a',
    name: 'Kuinre',
    town: 'Kuinre',
    streetAddress: 'Burchtstraat 7',
    postalCode: '8374 KC',
    lat: 52.78585,
    lng: 5.84193,
    electric: true,
    isCargoBike: false,
    available: 5,
    capacity: 6,
    rented: 1,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: 'd73f89a7-0a03-4a45-82e3-dbb1db6fc194',
    name: 'Sint Jansklooster',
    town: 'Sint Jansklooster',
    streetAddress: 'Leeuwte 78',
    postalCode: '8326 AD',
    lat: 52.681797,
    lng: 6.002715,
    electric: true,
    isCargoBike: false,
    available: 3,
    capacity: 5,
    rented: 2,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: 'c2160284-86ca-4e9a-94fd-e02fbee888a1',
    name: 'Steenwijk Paardenmarkt',
    town: 'Steenwijk',
    streetAddress: 'Paardenmarkt 1',
    postalCode: '8331 JW',
    lat: 52.787254,
    lng: 6.112625,
    electric: true,
    isCargoBike: false,
    available: 3,
    capacity: 5,
    rented: 2,
    pricing: { startTariff: 0.75, per15Min: 0.75, perDay: 30 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_available_ebike_29959178d8.png',
  },
  {
    stationId: 'a4e08bb3-af40-49be-816d-45aa001733c3',
    name: 'Cargobike Steenwijk',
    town: 'Steenwijk',
    streetAddress: 'Stationsplein 6, perron 4',
    postalCode: '8331 GM',
    lat: 52.79095,
    lng: 6.1165,
    electric: true,
    isCargoBike: true,
    available: 0,
    capacity: 1,
    rented: 1,
    pricing: { startTariff: 0.75, per15Min: 1.5, perDay: 50 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_unavailable_ebike_77759c6c2d.png',
  },
  {
    stationId: 'd8117d0a-1a29-41a2-ad66-cccb72604b02',
    name: 'Cargobike Giethoorn',
    town: 'Giethoorn',
    streetAddress: 'Dominee T.O. Hylkemaweg 1a',
    postalCode: '8355 DL',
    lat: 52.72166,
    lng: 6.07925,
    electric: true,
    isCargoBike: true,
    available: 0,
    capacity: 1,
    rented: 1,
    pricing: { startTariff: 0.75, per15Min: 1.5, perDay: 50 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_unavailable_ebike_77759178d8.png',
  },
  {
    stationId: '1d20db6a-124e-43f9-8e8b-86c6d9436434',
    name: 'Cargobike Steenwijkerwold',
    town: 'Steenwijkerwold',
    streetAddress: 'Oldemarktseweg 117',
    postalCode: '8341 SC',
    lat: 52.80444,
    lng: 6.06585,
    electric: true,
    isCargoBike: true,
    available: 0,
    capacity: 1,
    rented: 1,
    pricing: { startTariff: 0.75, per15Min: 1.5, perDay: 50 },
    markerImageUrl:
      'https://assets.deelfietsnederland.nl/uploads/assets/marker_unavailable_ebike_77759c6c2d.png',
  },
];

function computeDailyTotalRentals(dayEntries: DeelfietsLogEntry[]): number {
  if (dayEntries.length === 0) return 0;
  const sumNew = dayEntries.reduce((acc, e) => acc + Math.max(0, e.newRentals), 0);
  const peakConcurrent = dayEntries.reduce((acc, e) => Math.max(acc, e.rentedBikes), 0);
  return Math.max(sumNew, peakConcurrent);
}

function computeGroupMetrics(entries: DeelfietsLogEntry[]): {
  avgAvailable: number;
  avgRented: number;
  totalRented: number;
  daysCovered: number;
} {
  if (entries.length === 0) {
    return { avgAvailable: 0, avgRented: 0, totalRented: 0, daysCovered: 0 };
  }

  const totalAvail = entries.reduce((acc, e) => acc + e.availableBikes, 0);
  const totalRentedSnapshots = entries.reduce((acc, e) => acc + e.rentedBikes, 0);

  const byDay = new Map<string, DeelfietsLogEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.date) || [];
    list.push(e);
    byDay.set(e.date, list);
  }

  let totalRentedAcrossDays = 0;
  for (const dayList of byDay.values()) {
    totalRentedAcrossDays += computeDailyTotalRentals(dayList);
  }

  return {
    avgAvailable: Number((totalAvail / entries.length).toFixed(1)),
    avgRented: Number((totalRentedSnapshots / entries.length).toFixed(1)),
    totalRented: totalRentedAcrossDays,
    daysCovered: byDay.size,
  };
}

export function aggregateDeelfietsStats(
  locations: DeelfietsLocation[],
  logs: DeelfietsLogEntry[],
  selectedDay: string,
  selectedWeek: string,
  selectedMonth: string,
  activeMode: 'day' | 'week' | 'month'
): DeelfietsPeriodStats[] {
  const nowInfo = getISOWeekInfo(new Date());
  const targetDay = selectedDay || nowInfo.dateStr;
  const targetWeek = selectedWeek || nowInfo.yearWeek;
  const targetMonth = selectedMonth || nowInfo.yearMonth;

  return locations.map((loc) => {
    const locLogs = logs.filter((l) => l.stationId === loc.stationId);
    const dayLogs = locLogs.filter((l) => l.date === targetDay);
    const weekLogs = locLogs.filter((l) => l.yearWeek === targetWeek);
    const monthLogs = locLogs.filter((l) => l.yearMonth === targetMonth);

    const dayM =
      dayLogs.length > 0
        ? computeGroupMetrics(dayLogs)
        : {
            avgAvailable: loc.available,
            avgRented: loc.rented,
            totalRented: loc.rented,
            daysCovered: 1,
          };

    const weekM =
      weekLogs.length > 0
        ? computeGroupMetrics(weekLogs)
        : {
            avgAvailable: loc.available,
            avgRented: loc.rented,
            totalRented: loc.rented,
            daysCovered: 1,
          };

    const monthM =
      monthLogs.length > 0
        ? computeGroupMetrics(monthLogs)
        : {
            avgAvailable: loc.available,
            avgRented: loc.rented,
            totalRented: loc.rented,
            daysCovered: 1,
          };

    const activeMetrics =
      activeMode === 'day' ? dayM : activeMode === 'week' ? weekM : monthM;
    const activeLogs =
      activeMode === 'day' ? dayLogs : activeMode === 'week' ? weekLogs : monthLogs;
    const periodLabel =
      activeMode === 'day'
        ? targetDay
        : activeMode === 'week'
        ? targetWeek
        : targetMonth;

    return {
      stationId: loc.stationId,
      locationName: loc.name,
      town: loc.town,
      streetAddress: loc.streetAddress,
      electric: loc.electric,
      isCargoBike: loc.isCargoBike,
      periodLabel,
      sampleCount: activeLogs.length,
      daysCovered: activeMetrics.daysCovered,
      currentAvailable: loc.available,
      currentRented: loc.rented,
      capacity: loc.capacity,
      avgAvailableBikes: activeMetrics.avgAvailable,
      avgRentedBikes: activeMetrics.avgRented,
      totalRentedBikes: activeMetrics.totalRented,
      avgAvailableDay: dayM.avgAvailable,
      avgAvailableWeek: weekM.avgAvailable,
      avgAvailableMonth: monthM.avgAvailable,
      avgRentedDay: dayM.avgRented,
      avgRentedWeek: weekM.avgRented,
      avgRentedMonth: monthM.avgRented,
      totalRentedDay: dayM.totalRented,
      totalRentedWeek: weekM.totalRented,
      totalRentedMonth: monthM.totalRented,
    };
  });
}

export function exportDeelfietsStatsToCSV(stats: DeelfietsPeriodStats[]): string {
  const headers = [
    'Periode',
    'Plaats',
    'Deelfietslocatie',
    'Adres',
    'Type Fiets',
    'Capaciteit',
    'Nu Beschikbaar',
    'Nu Gehuurd',
    'Gem. Beschikbaar (Dag)',
    'Gem. Beschikbaar (Week)',
    'Gem. Beschikbaar (Maand)',
    'Gem. Gehuurd (Dag)',
    'Gem. Gehuurd (Week)',
    'Gem. Gehuurd (Maand)',
    'Totaal Gehuurd (Dag)',
    'Totaal Gehuurd (Week)',
    'Totaal Gehuurd (Maand)',
    'Aantal Metingen',
  ];

  const rows = stats.map((s) => [
    s.periodLabel,
    `"${s.town.replace(/"/g, '""')}"`,
    `"${s.locationName.replace(/"/g, '""')}"`,
    `"${s.streetAddress.replace(/"/g, '""')}"`,
    s.isCargoBike ? 'Elektrische Deelbakfiets' : s.electric ? 'Elektrisch' : 'Regulier',
    s.capacity,
    s.currentAvailable,
    s.currentRented,
    String(s.avgAvailableDay).replace('.', ','),
    String(s.avgAvailableWeek).replace('.', ','),
    String(s.avgAvailableMonth).replace('.', ','),
    String(s.avgRentedDay).replace('.', ','),
    String(s.avgRentedWeek).replace('.', ','),
    String(s.avgRentedMonth).replace('.', ','),
    s.totalRentedDay,
    s.totalRentedWeek,
    s.totalRentedMonth,
    s.sampleCount,
  ]);

  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

export function exportRawDeelfietsLogsToCSV(logs: DeelfietsLogEntry[]): string {
  const headers = [
    'Tijdstip',
    'Datum',
    'Uurvak',
    'Jaar-Maand',
    'Jaar-Week',
    'Plaats',
    'Deelfietslocatie',
    'Adres',
    'Type Fiets',
    'Capaciteit',
    'Beschikbare Fietsen',
    'Gehuurde Fietsen (Actief)',
    'Nieuwe Verhuringen in Uurvak',
  ];

  const sorted = [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const rows = sorted.map((l) => [
    l.timestamp,
    l.date,
    l.hourSlot,
    l.yearMonth,
    l.yearWeek,
    `"${l.town.replace(/"/g, '""')}"`,
    `"${l.locationName.replace(/"/g, '""')}"`,
    `"${l.streetAddress.replace(/"/g, '""')}"`,
    l.isCargoBike ? 'Elektrische Deelbakfiets' : l.electric ? 'Elektrisch' : 'Regulier',
    l.capacity,
    l.availableBikes,
    l.rentedBikes,
    l.newRentals,
  ]);

  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}
