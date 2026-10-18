import { BusStop } from '../types/bus';

export type TripPassStatus = 'ontime' | 'delayed' | 'early' | 'cancelled';

export interface PunctualityLogEntry {
  id: string; // e.g. "2026-10-18_QBUZZ:d026:5_swk-halte-22"
  timestamp: string; // ISO timestamp when logged
  date: string; // YYYY-MM-DD
  yearMonth: string; // YYYY-MM (e.g. "2026-10")
  isoYear: number;
  isoWeek: number; // 1..53
  yearWeek: string; // YYYY-Www (e.g. "2026-W42")
  stopId: string;
  stopCode: string;
  stopName: string; // Haltenaam
  town: string; // Plaats
  line: string; // Lijnnummer
  operator: string;
  destination: string;
  journeyId: string;
  plannedTime: string; // HH:mm
  actualTime: string; // HH:mm or "Uitgevallen"
  delayMinutes: number; // > 0 = vertraagd (min), < 0 = te vroeg (min), 0 = op tijd
  status: TripPassStatus;
}

export interface PunctualityFilter {
  periodType: 'all' | 'month' | 'week';
  yearMonth?: string; // e.g. "2026-10"
  yearWeek?: string; // e.g. "2026-W42"
  line?: string; // optional line filter
  searchQuery?: string; // optional stop/town search
}

export interface StopPunctualityStats {
  stopId: string;
  stopCode: string;
  town: string;
  stopName: string;
  lines: string[];
  totalRecordedTrips: number;
  cancelledCount: number;
  cancelledPercent: number;
  delayedCount: number;
  avgDelayWhenDelayedMin: number; // Gemiddelde vertraging van vertraagde ritten (min)
  avgDelayAllOperatedMin: number; // Gemiddelde vertraging over alle gereden ritten (min)
  earlyCount: number;
  avgEarlyMinutes: number; // Gemiddeld aantal minuten dat te vroege ritten te vroeg waren (positief getal in min)
  onTimeCount: number;
  onTimePercent: number;
}

export interface LinePunctualityStats {
  line: string;
  operator: string;
  routeSummary: string;
  totalRecordedTrips: number;
  cancelledCount: number;
  cancelledPercent: number;
  delayedCount: number;
  avgDelayWhenDelayedMin: number;
  avgDelayAllOperatedMin: number;
  earlyCount: number;
  avgEarlyMinutes: number;
  onTimeCount: number;
  onTimePercent: number;
}

export function getISOWeekInfo(d: Date): {
  dateStr: string;
  yearMonth: string;
  isoYear: number;
  isoWeek: number;
  yearWeek: string;
} {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const isoYear = date.getUTCFullYear();

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const ww = String(isoWeek).padStart(2, '0');

  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    yearMonth: `${yyyy}-${mm}`,
    isoYear,
    isoWeek,
    yearWeek: `${isoYear}-W${ww}`,
  };
}

export function sanitizeLogId(raw: string): string {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9_\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (cleaned || 'log_entry').slice(0, 120);
}

export function filterPunctualityLogs(
  logs: PunctualityLogEntry[],
  filter: PunctualityFilter
): PunctualityLogEntry[] {
  return logs.filter((entry) => {
    if (filter.periodType === 'month' && filter.yearMonth && entry.yearMonth !== filter.yearMonth) {
      return false;
    }
    if (filter.periodType === 'week' && filter.yearWeek && entry.yearWeek !== filter.yearWeek) {
      return false;
    }
    if (filter.line && filter.line !== 'ALL' && entry.line !== filter.line) {
      return false;
    }
    if (filter.searchQuery && filter.searchQuery.trim() !== '') {
      const q = filter.searchQuery.toLowerCase().trim();
      const matchTown = entry.town.toLowerCase().includes(q);
      const matchStop = entry.stopName.toLowerCase().includes(q);
      const matchLine = entry.line.toLowerCase().includes(q);
      if (!matchTown && !matchStop && !matchLine) return false;
    }
    return true;
  });
}

export function computeStopStats(
  logs: PunctualityLogEntry[],
  allStops: BusStop[],
  filter: PunctualityFilter
): StopPunctualityStats[] {
  const filtered = filterPunctualityLogs(logs, filter);

  // Group by stopId (or town + stopName)
  const byStop = new Map<string, PunctualityLogEntry[]>();
  for (const log of filtered) {
    const key = `${log.town}::${log.stopName}`;
    const arr = byStop.get(key) || [];
    arr.push(log);
    byStop.set(key, arr);
  }

  // Deduplicate physical stop platforms with same (town, name) so every unique halte has unified stats
  const uniqueStopsMap = new Map<string, BusStop>();
  for (const s of allStops) {
    const key = `${s.town}::${s.name}`;
    if (!uniqueStopsMap.has(key)) {
      uniqueStopsMap.set(key, s);
    } else {
      const existing = uniqueStopsMap.get(key)!;
      const mergedLines = Array.from(new Set([...existing.lines, ...s.lines]));
      uniqueStopsMap.set(key, { ...existing, lines: mergedLines });
    }
  }

  const results: StopPunctualityStats[] = [];

  for (const [key, stop] of uniqueStopsMap.entries()) {
    if (filter.line && filter.line !== 'ALL' && !stop.lines.includes(filter.line)) {
      continue;
    }
    if (filter.searchQuery && filter.searchQuery.trim() !== '') {
      const q = filter.searchQuery.toLowerCase().trim();
      if (
        !stop.town.toLowerCase().includes(q) &&
        !stop.name.toLowerCase().includes(q) &&
        !stop.lines.some((l) => l.toLowerCase().includes(q))
      ) {
        continue;
      }
    }

    const entries = byStop.get(key) || [];
    const total = entries.length;
    const cancelled = entries.filter((e) => e.status === 'cancelled');
    const operated = entries.filter((e) => e.status !== 'cancelled');
    const delayed = operated.filter((e) => e.status === 'delayed' || e.delayMinutes > 0);
    const early = operated.filter((e) => e.status === 'early' || e.delayMinutes < 0);
    const onTime = operated.filter((e) => e.status === 'ontime' && e.delayMinutes === 0);

    const sumDelayedMin = delayed.reduce((acc, e) => acc + Math.max(0, e.delayMinutes), 0);
    const avgDelayWhenDelayedMin =
      delayed.length > 0 ? Number((sumDelayedMin / delayed.length).toFixed(2)) : 0;

    const avgDelayAllOperatedMin =
      operated.length > 0 ? Number((sumDelayedMin / operated.length).toFixed(2)) : 0;

    const sumEarlyMin = early.reduce((acc, e) => acc + Math.abs(Math.min(0, e.delayMinutes)), 0);
    const avgEarlyMinutes =
      early.length > 0 ? Number((sumEarlyMin / early.length).toFixed(2)) : 0;

    const cancelledPercent = total > 0 ? Number(((cancelled.length / total) * 100).toFixed(1)) : 0;
    const onTimePercent = total > 0 ? Number(((onTime.length / total) * 100).toFixed(1)) : 0;

    results.push({
      stopId: stop.id,
      stopCode: stop.stopCode || '',
      town: stop.town,
      stopName: stop.name,
      lines: stop.lines,
      totalRecordedTrips: total,
      cancelledCount: cancelled.length,
      cancelledPercent,
      delayedCount: delayed.length,
      avgDelayWhenDelayedMin,
      avgDelayAllOperatedMin,
      earlyCount: early.length,
      avgEarlyMinutes,
      onTimeCount: onTime.length,
      onTimePercent,
    });
  }

  return results.sort((a, b) => {
    if (b.totalRecordedTrips !== a.totalRecordedTrips) {
      return b.totalRecordedTrips - a.totalRecordedTrips;
    }
    return a.town.localeCompare(b.town) || a.stopName.localeCompare(b.stopName);
  });
}

const LINE_DESCRIPTIONS: Record<string, { operator: string; summary: string }> = {
  '26': { operator: 'Qbuzz', summary: 'Steenwijk Station ⇔ Kallenkote ⇔ Nijeveen ⇔ Meppel Station' },
  '70': { operator: 'RRReis (EBS)', summary: 'Oldemarkt ⇔ Steenwijk Station ⇔ Giethoorn ⇔ Zwartsluis' },
  '214': { operator: 'snelRRReis (EBS)', summary: 'Steenwijk Station ⇔ Scheerwolde ⇔ Wetering ⇔ Blokzijl ⇔ Lelystad' },
  '18': { operator: 'Qbuzz', summary: 'Steenwijk Station ⇔ Eesveen ⇔ Noordwolde ⇔ Oosterwolde' },
  '20': { operator: 'Qbuzz', summary: 'Steenwijk Station ⇔ Eesveen ⇔ Vledder ⇔ Assen' },
  '524': { operator: 'Qbuzz Buurtbus', summary: 'Steenwijk Station ⇔ Bedelaarspad ⇔ Onnaseveld ⇔ Darp ⇔ Havelte' },
  '71': { operator: 'RRReis (EBS)', summary: 'Zwolle ⇔ Zwartsluis ⇔ Sint Jansklooster ⇔ Vollenhove ⇔ Emmeloord' },
  '171': { operator: 'RRReis (EBS)', summary: 'Zwolle ⇔ Zwartsluis ⇔ Sint Jansklooster (Kadoelen) ⇔ Vollenhove' },
  '76': { operator: 'RRReis (EBS)', summary: 'Steenwijk ⇔ Oldemarkt ⇔ Ossenzijl ⇔ Kuinre ⇔ Marknesse' },
  '146': { operator: 'RRReis (EBS)', summary: 'Steenwijk ⇔ Oldemarkt ⇔ Kuinre ⇔ Emmeloord' },
  '217': { operator: 'Qbuzz flexBuzz', summary: 'Steenwijk Station ⇔ Tuk ⇔ Willemsoord ⇔ Wolvega' },
  '270': { operator: 'RRReis (EBS)', summary: 'Steenwijk Station ⇔ Giethoorn' },
  '675': { operator: 'RRReis (EBS)', summary: 'Scholierenlijn Steenwijk Station ⇔ Oldemarkt ⇔ Kuinre' },
  '679': { operator: 'RRReis (EBS)', summary: 'Scholierenlijn Vollenhove ⇔ Sint Jansklooster ⇔ Wanneperveen ⇔ Meppel' },
};

export function computeLineStats(
  logs: PunctualityLogEntry[],
  filter: PunctualityFilter
): LinePunctualityStats[] {
  const filtered = filterPunctualityLogs(logs, { ...filter, searchQuery: '' });

  const byLine = new Map<string, PunctualityLogEntry[]>();
  for (const lineKey of Object.keys(LINE_DESCRIPTIONS)) {
    byLine.set(lineKey, []);
  }
  for (const log of filtered) {
    const arr = byLine.get(log.line) || [];
    arr.push(log);
    byLine.set(log.line, arr);
  }

  const results: LinePunctualityStats[] = [];

  for (const [line, entries] of byLine.entries()) {
    if (filter.line && filter.line !== 'ALL' && line !== filter.line) continue;

    const total = entries.length;
    const cancelled = entries.filter((e) => e.status === 'cancelled');
    const operated = entries.filter((e) => e.status !== 'cancelled');
    const delayed = operated.filter((e) => e.status === 'delayed' || e.delayMinutes > 0);
    const early = operated.filter((e) => e.status === 'early' || e.delayMinutes < 0);
    const onTime = operated.filter((e) => e.status === 'ontime' && e.delayMinutes === 0);

    const sumDelayedMin = delayed.reduce((acc, e) => acc + Math.max(0, e.delayMinutes), 0);
    const avgDelayWhenDelayedMin =
      delayed.length > 0 ? Number((sumDelayedMin / delayed.length).toFixed(2)) : 0;
    const avgDelayAllOperatedMin =
      operated.length > 0 ? Number((sumDelayedMin / operated.length).toFixed(2)) : 0;

    const sumEarlyMin = early.reduce((acc, e) => acc + Math.abs(Math.min(0, e.delayMinutes)), 0);
    const avgEarlyMinutes =
      early.length > 0 ? Number((sumEarlyMin / early.length).toFixed(2)) : 0;

    const cancelledPercent = total > 0 ? Number(((cancelled.length / total) * 100).toFixed(1)) : 0;
    const onTimePercent = total > 0 ? Number(((onTime.length / total) * 100).toFixed(1)) : 0;

    const meta = LINE_DESCRIPTIONS[line] || {
      operator: entries[0]?.operator || 'OV Steenwijkerland',
      summary: `Lijn ${line}`,
    };

    results.push({
      line,
      operator: meta.operator,
      routeSummary: meta.summary,
      totalRecordedTrips: total,
      cancelledCount: cancelled.length,
      cancelledPercent,
      delayedCount: delayed.length,
      avgDelayWhenDelayedMin,
      avgDelayAllOperatedMin,
      earlyCount: early.length,
      avgEarlyMinutes,
      onTimeCount: onTime.length,
      onTimePercent,
    });
  }

  return results.sort((a, b) => Number(a.line) - Number(b.line));
}

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportStopStatsToCSV(
  stats: StopPunctualityStats[],
  periodLabel: string
): string {
  const headers = [
    'Periode',
    'Plaats',
    'Haltenaam',
    'DRGL_Haltecode',
    'Bediende_Lijnen',
    'Totaal_Gelogde_Ritten',
    'Uitgevallen_Ritten',
    'Uitgevallen_Percentage',
    'Vertraagde_Ritten',
    'Gemiddelde_Vertraging_Vertraagde_Ritten_Min',
    'Gemiddelde_Vertraging_Alle_Gereden_Ritten_Min',
    'Te_Vroeg_Gepasseerd_Ritten',
    'Gemiddeld_Te_Vroeg_Minuten',
    'Op_Tijd_Ritten',
    'Op_Tijd_Percentage',
  ];

  const rows = stats.map((s) =>
    [
      periodLabel,
      s.town,
      s.stopName,
      s.stopCode,
      s.lines.join(', '),
      s.totalRecordedTrips,
      s.cancelledCount,
      `${s.cancelledPercent}%`,
      s.delayedCount,
      String(s.avgDelayWhenDelayedMin).replace('.', ','),
      String(s.avgDelayAllOperatedMin).replace('.', ','),
      s.earlyCount,
      String(s.avgEarlyMinutes).replace('.', ','),
      s.onTimeCount,
      `${s.onTimePercent}%`,
    ]
      .map(escapeCsvCell)
      .join(';')
  );

  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

export function exportLineStatsToCSV(
  stats: LinePunctualityStats[],
  periodLabel: string
): string {
  const headers = [
    'Periode',
    'Lijnnummer',
    'Vervoerder',
    'Traject',
    'Totaal_Gelogde_Ritten',
    'Uitgevallen_Ritten',
    'Uitgevallen_Percentage',
    'Vertraagde_Ritten',
    'Gemiddelde_Vertraging_Vertraagde_Ritten_Min',
    'Gemiddelde_Vertraging_Alle_Gereden_Ritten_Min',
    'Te_Vroeg_Gepasseerd_Ritten',
    'Gemiddeld_Te_Vroeg_Minuten',
    'Op_Tijd_Ritten',
    'Op_Tijd_Percentage',
  ];

  const rows = stats.map((s) =>
    [
      periodLabel,
      s.line,
      s.operator,
      s.routeSummary,
      s.totalRecordedTrips,
      s.cancelledCount,
      `${s.cancelledPercent}%`,
      s.delayedCount,
      String(s.avgDelayWhenDelayedMin).replace('.', ','),
      String(s.avgDelayAllOperatedMin).replace('.', ','),
      s.earlyCount,
      String(s.avgEarlyMinutes).replace('.', ','),
      s.onTimeCount,
      `${s.onTimePercent}%`,
    ]
      .map(escapeCsvCell)
      .join(';')
  );

  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

export function exportRawLogsToCSV(logs: PunctualityLogEntry[]): string {
  const headers = [
    'Datum',
    'Maand',
    'ISO_Weeknummer',
    'Tijdstip_Gelogd',
    'Plaats',
    'Haltenaam',
    'DRGL_Haltecode',
    'Lijnnummer',
    'Vervoerder',
    'Bestemming',
    'Rit_ID',
    'Geplande_Tijd',
    'Werkelijke_Tijd',
    'Status',
    'Vertraging_Minuten',
    'Te_Vroeg_Minuten',
  ];

  const statusNL: Record<TripPassStatus, string> = {
    ontime: 'Op tijd',
    delayed: 'Vertraagd',
    early: 'Te vroeg gepasseerd',
    cancelled: 'Uitgevallen',
  };

  const rows = logs.map((l) =>
    [
      l.date,
      l.yearMonth,
      l.yearWeek,
      l.timestamp,
      l.town,
      l.stopName,
      l.stopCode,
      l.line,
      l.operator,
      l.destination,
      l.journeyId,
      l.plannedTime,
      l.actualTime,
      statusNL[l.status] || l.status,
      l.delayMinutes > 0 ? String(l.delayMinutes).replace('.', ',') : '0',
      l.delayMinutes < 0 ? String(Math.abs(l.delayMinutes)).replace('.', ',') : '0',
    ]
      .map(escapeCsvCell)
      .join(';')
  );

  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}
