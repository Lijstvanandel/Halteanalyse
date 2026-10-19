import { getISOWeekInfo } from './punctuality';

export interface OvFietsLocation {
  stationCode: string; // 'swk002'
  name: string; // 'Station Steenwijk'
  town: string; // 'Steenwijk'
  streetAddress: string; // 'Stationsplein 2'
  postalCode: string; // '8331 GM'
  lat: number; // 52.79051
  lng: number; // 6.11712
  serviceType: string;
  totalCapacity: number; // 33
  available: number; // e.g. 6
  rented: number; // e.g. 27
  rentalTariff: string;
  markerImageUrl: string;
  openingHours: { day: string; hours: string }[];
  lastUpdated: string;
  sourceUrl: string;
}

export interface OvFietsLogEntry {
  id: string;
  timestamp: string;
  date: string; // YYYY-MM-DD
  hour: string; // HH:00
  yearMonth: string; // YYYY-MM
  isoYear: number;
  isoWeek: number;
  yearWeek: string; // YYYY-Www
  stationCode: string;
  name: string;
  capacity: number;
  available: number;
  rented: number;
  newRentals: number;
}

export interface OvFietsPeriodStats {
  stationCode: string;
  name: string;
  town: string;
  streetAddress: string;
  currentAvailable: number;
  currentRented: number;
  capacity: number;
  // Explicit breakdown
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

export const OFFICIAL_STEENWIJK_OVFIETS: OvFietsLocation = {
  stationCode: 'swk002',
  name: 'Station Steenwijk',
  town: 'Steenwijk',
  streetAddress: 'Stationsplein 2',
  postalCode: '8331 GM',
  lat: 52.79051,
  lng: 6.11712,
  serviceType: 'Zelfservice stalling (OV-chipkaart als sleutel)',
  totalCapacity: 33,
  available: 6,
  rented: 27,
  rentalTariff: '€ 4,55 per 24 uur (eerste 72 uur)',
  markerImageUrl: '/bicycle_parking_open.png',
  openingHours: [
    { day: 'Maandag', hours: '05:30u - 00:30u' },
    { day: 'Dinsdag', hours: '05:30u - 00:30u' },
    { day: 'Woensdag', hours: '05:30u - 00:30u' },
    { day: 'Donderdag', hours: '05:30u - 00:30u' },
    { day: 'Vrijdag', hours: '05:30u - 01:30u' },
    { day: 'Zaterdag', hours: '07:00u - 00:30u' },
    { day: 'Zondag', hours: '07:00u - 01:30u' },
  ],
  lastUpdated: new Date().toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }),
  sourceUrl: 'https://ovfietsbeschikbaar.nl/locatie/swk002',
};

function computeDailyRentals(dayEntries: OvFietsLogEntry[]): number {
  if (dayEntries.length === 0) return 0;
  const sumNew = dayEntries.reduce((acc, e) => acc + Math.max(0, e.newRentals), 0);
  const peakConcurrent = dayEntries.reduce((acc, e) => Math.max(acc, e.rented), 0);
  return Math.max(sumNew, peakConcurrent);
}

function computeMetrics(entries: OvFietsLogEntry[]): {
  avgAvailable: number;
  avgRented: number;
  totalRented: number;
} {
  if (entries.length === 0) {
    return { avgAvailable: 0, avgRented: 0, totalRented: 0 };
  }

  const sumAvail = entries.reduce((a, b) => a + b.available, 0);
  const sumRented = entries.reduce((a, b) => a + b.rented, 0);

  const byDay = new Map<string, OvFietsLogEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.date) || [];
    list.push(e);
    byDay.set(e.date, list);
  }

  let totalRented = 0;
  for (const dayList of byDay.values()) {
    totalRented += computeDailyRentals(dayList);
  }

  return {
    avgAvailable: Number((sumAvail / entries.length).toFixed(1)),
    avgRented: Number((sumRented / entries.length).toFixed(1)),
    totalRented,
  };
}

export function aggregateOvFietsStats(
  loc: OvFietsLocation,
  logs: OvFietsLogEntry[],
  selectedDay?: string,
  selectedWeek?: string,
  selectedMonth?: string
): OvFietsPeriodStats {
  const nowInfo = getISOWeekInfo(new Date());
  const targetDay = selectedDay || nowInfo.dateStr;
  const targetWeek = selectedWeek || nowInfo.yearWeek;
  const targetMonth = selectedMonth || nowInfo.yearMonth;

  const dayLogs = logs.filter((l) => l.date === targetDay);
  const weekLogs = logs.filter((l) => l.yearWeek === targetWeek);
  const monthLogs = logs.filter((l) => l.yearMonth === targetMonth);

  const dayM =
    dayLogs.length > 0
      ? computeMetrics(dayLogs)
      : { avgAvailable: loc.available, avgRented: loc.rented, totalRented: loc.rented };

  const weekM =
    weekLogs.length > 0
      ? computeMetrics(weekLogs)
      : { avgAvailable: loc.available, avgRented: loc.rented, totalRented: loc.rented };

  const monthM =
    monthLogs.length > 0
      ? computeMetrics(monthLogs)
      : { avgAvailable: loc.available, avgRented: loc.rented, totalRented: loc.rented };

  return {
    stationCode: loc.stationCode,
    name: loc.name,
    town: loc.town,
    streetAddress: loc.streetAddress,
    currentAvailable: loc.available,
    currentRented: loc.rented,
    capacity: loc.totalCapacity,
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
}

export function exportOvFietsStatsToCSV(stats: OvFietsPeriodStats): string {
  const headers = [
    'Locatiecode',
    'Station',
    'Plaats',
    'Adres',
    'Capaciteit (Totaal)',
    'Nu Beschikbaar',
    'Nu Verhuurd',
    'Gem. Beschikbaar (Dag)',
    'Gem. Beschikbaar (Week)',
    'Gem. Beschikbaar (Maand)',
    'Gem. Gehuurd (Dag)',
    'Gem. Gehuurd (Week)',
    'Gem. Gehuurd (Maand)',
    'Totaal Gehuurd (Dag)',
    'Totaal Gehuurd (Week)',
    'Totaal Gehuurd (Maand)',
  ];

  const row = [
    stats.stationCode,
    `"${stats.name}"`,
    `"${stats.town}"`,
    `"${stats.streetAddress}"`,
    stats.capacity,
    stats.currentAvailable,
    stats.currentRented,
    stats.avgAvailableDay,
    stats.avgAvailableWeek,
    stats.avgAvailableMonth,
    stats.avgRentedDay,
    stats.avgRentedWeek,
    stats.avgRentedMonth,
    stats.totalRentedDay,
    stats.totalRentedWeek,
    stats.totalRentedMonth,
  ];

  return '\uFEFF' + [headers.join(';'), row.join(';')].join('\r\n');
}

export function exportRawOvFietsLogsToCSV(logs: OvFietsLogEntry[]): string {
  const headers = [
    'Tijdstip',
    'Datum',
    'Uur',
    'Jaar-Maand',
    'Jaar-Week',
    'Locatiecode',
    'Station',
    'Capaciteit',
    'Beschikbare Fietsen',
    'Gehuurde Fietsen',
    'Nieuwe Verhuringen in Uurvak',
  ];

  const sorted = [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const rows = sorted.map((l) => [
    l.timestamp,
    l.date,
    l.hour,
    l.yearMonth,
    l.yearWeek,
    l.stationCode,
    `"${l.name}"`,
    l.capacity,
    l.available,
    l.rented,
    l.newRentals,
  ]);

  return (
    '\uFEFF' +
    [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')
  );
}
