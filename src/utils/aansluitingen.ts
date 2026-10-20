import {
  ConnectionLogEntry,
  ConnectionStatus,
  ConnectionSummary,
  DirectionStats,
  TransferDirection,
} from '../types/train';
import { getISOWeekInfo } from './punctuality';

export function sanitizeConnectionLogId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9_\-:.]/g, '_').slice(0, 140);
}

/**
 * Calculates whether a pair of arrival and departure at Station Steenwijk
 * forms a valid planned transfer (3-15 minutes prior) and whether the connection
 * was realized (at least 3.0 minutes actual transfer time).
 * 
 * Supports both:
 * - 'bus_naar_trein' (Bus arrives at Stationsplein, passenger walks to Spoor 1/2 for train)
 * - 'trein_naar_bus' (Train arrives at Spoor 1/2, passenger walks to Stationsplein for bus)
 */
export function evaluateConnection(
  direction: TransferDirection,
  originPlannedArr: string, // "HH:MM"
  originDelayMinutes: number,
  connectingPlannedDep: string, // "HH:MM"
  connectingDelayMinutes: number,
  trainType: 'Intercity' | 'Sprinter' = 'Intercity'
): {
  isValidPlannedTransfer: boolean;
  plannedTransferMinutes: number;
  realizedTransferMinutes: number;
  status: ConnectionStatus;
  notes: string;
} {
  const parseMin = (hhmm: string) => {
    const [h, m] = (hhmm || '00:00').split(':').map((s) => parseInt(s, 10));
    return (h || 0) * 60 + (m || 0);
  };

  const originPlannedTotal = parseMin(originPlannedArr);
  const connectingPlannedTotal = parseMin(connectingPlannedDep);

  // Planned difference in minutes (handling midnight wrap-around)
  let plannedDiff = connectingPlannedTotal - originPlannedTotal;
  if (plannedDiff < -720) plannedDiff += 1440;
  if (plannedDiff > 720) plannedDiff -= 1440;

  // The transfer is officially in scope if scheduled arrival is between 3 and 15 minutes before connecting departure
  const isValidPlannedTransfer = plannedDiff >= 3 && plannedDiff <= 15;

  // Actual minutes:
  const originActualTotal = originPlannedTotal + originDelayMinutes;
  const connectingActualTotal = connectingPlannedTotal + connectingDelayMinutes;

  let realizedDiff = connectingActualTotal - originActualTotal;
  if (realizedDiff < -720) realizedDiff += 1440;
  if (realizedDiff > 720) realizedDiff -= 1440;

  const roundedRealized = Number(realizedDiff.toFixed(1));

  // Minimum walking transfer requirement between Stationsplein and Spoor 1/2 is 3.0 minutes
  const isMade = roundedRealized >= 3.0;
  const status: ConnectionStatus = isMade ? 'gehaald' : 'gemist';

  let notes = '';
  if (direction === 'bus_naar_trein') {
    if (status === 'gehaald') {
      if (originDelayMinutes > 2 && connectingDelayMinutes > 1) {
        notes = `Bus +${originDelayMinutes}m, maar ${trainType} +${connectingDelayMinutes}m vertraging redde de overstap (${roundedRealized}m marge)`;
      } else if (originDelayMinutes > 0) {
        notes = `Bus vertraagd (+${originDelayMinutes}m), overstap op ${trainType} net gehaald (${roundedRealized}m marge)`;
      } else {
        notes = `Reguliere aansluiting op ${trainType} succesvol (${roundedRealized}m overstaptijd)`;
      }
    } else {
      if (roundedRealized < 0) {
        notes = `Aansluiting gemist: ${trainType} vertrok ${Math.abs(roundedRealized)} min vóór aankomst van de bus`;
      } else {
        notes = `Aansluiting gemist: slechts ${roundedRealized}m overstap naar ${trainType} (min. 3m vereist)`;
      }
    }
  } else {
    // trein_naar_bus
    if (status === 'gehaald') {
      if (originDelayMinutes > 2 && connectingDelayMinutes > 1) {
        notes = `${trainType} +${originDelayMinutes}m vertraagd, maar vertraagde bus (+${connectingDelayMinutes}m) redde de overstap (${roundedRealized}m marge)`;
      } else if (originDelayMinutes > 0) {
        notes = `${trainType} vertraagd (+${originDelayMinutes}m), overstap naar bus net gehaald (${roundedRealized}m marge)`;
      } else {
        notes = `Reguliere aansluiting van ${trainType} naar bus succesvol (${roundedRealized}m overstaptijd)`;
      }
    } else {
      if (roundedRealized < 0) {
        notes = `Aansluiting gemist: bus vertrok ${Math.abs(roundedRealized)} min vóór aankomst van de ${trainType}`;
      } else {
        notes = `Aansluiting gemist: slechts ${roundedRealized}m overstap vanaf de ${trainType} (min. 3m vereist)`;
      }
    }
  }

  return {
    isValidPlannedTransfer,
    plannedTransferMinutes: plannedDiff,
    realizedTransferMinutes: roundedRealized,
    status,
    notes,
  };
}

/**
 * Backward compatible alias for bus to train transfer evaluation
 */
export function evaluateBusTrainConnection(
  busPlannedArr: string,
  busDelayMinutes: number,
  trainPlannedDep: string,
  trainDelayMinutes: number,
  trainType: 'Intercity' | 'Sprinter' = 'Intercity'
) {
  return evaluateConnection(
    'bus_naar_trein',
    busPlannedArr,
    busDelayMinutes,
    trainPlannedDep,
    trainDelayMinutes,
    trainType
  );
}

function emptyStats(): DirectionStats {
  return {
    total: 0,
    made: 0,
    missed: 0,
    rate: 100,
    avgPlannedBufferMin: 0,
    avgRealizedMarginMin: 0,
  };
}

function computeStats(total: number, made: number, sumPlanned: number, sumRealized: number): DirectionStats {
  const missed = total - made;
  const rate = total > 0 ? Number(((made / total) * 100).toFixed(1)) : 100;
  const avgPlannedBufferMin = total > 0 ? Number((sumPlanned / total).toFixed(1)) : 0;
  const avgRealizedMarginMin = total > 0 ? Number((sumRealized / total).toFixed(1)) : 0;
  return { total, made, missed, rate, avgPlannedBufferMin, avgRealizedMarginMin };
}

/**
 * Aggregates ConnectionLogEntry items into comprehensive KPI cards and breakdowns:
 * - Overall KPIs
 * - By Direction (Bus ➔ Trein vs Trein ➔ Bus)
 * - By Train Type (Intercity vs Sprinter)
 * - Cross-Direction and Train Type
 * - By Bus Line
 */
export function aggregateConnectionStats(logs: ConnectionLogEntry[]): ConnectionSummary {
  const totalPlanned = logs.length;
  let transfersMade = 0;
  let transfersMissed = 0;
  let sumPlannedBuffer = 0;
  let sumRealizedMargin = 0;

  // Trackers
  const dirTracker = {
    bus_naar_trein: { total: 0, made: 0, sumPlan: 0, sumReal: 0 },
    trein_naar_bus: { total: 0, made: 0, sumPlan: 0, sumReal: 0 },
  };

  const typeTracker = {
    intercity: { total: 0, made: 0, sumPlan: 0, sumReal: 0 },
    sprinter: { total: 0, made: 0, sumPlan: 0, sumReal: 0 },
  };

  const crossTracker = {
    bus_naar_trein: {
      intercity: { total: 0, made: 0, sumPlan: 0, sumReal: 0 },
      sprinter: { total: 0, made: 0, sumPlan: 0, sumReal: 0 },
    },
    trein_naar_bus: {
      intercity: { total: 0, made: 0, sumPlan: 0, sumReal: 0 },
      sprinter: { total: 0, made: 0, sumPlan: 0, sumReal: 0 },
    },
  };

  const byLine: ConnectionSummary['byLine'] = {};

  for (const log of logs) {
    const isMade = log.status === 'gehaald';
    if (isMade) {
      transfersMade++;
    } else {
      transfersMissed++;
    }
    const planned = log.plannedTransferMinutes || 0;
    const realized = log.realizedTransferMinutes || 0;
    sumPlannedBuffer += planned;
    sumRealizedMargin += realized;

    const dir: TransferDirection = log.direction || 'bus_naar_trein';
    const isIc = (log.trainType || 'Intercity') === 'Intercity';
    const typeKey = isIc ? 'intercity' : 'sprinter';

    // Update direction
    dirTracker[dir].total++;
    dirTracker[dir].sumPlan += planned;
    dirTracker[dir].sumReal += realized;
    if (isMade) dirTracker[dir].made++;

    // Update train type
    typeTracker[typeKey].total++;
    typeTracker[typeKey].sumPlan += planned;
    typeTracker[typeKey].sumReal += realized;
    if (isMade) typeTracker[typeKey].made++;

    // Update cross
    crossTracker[dir][typeKey].total++;
    crossTracker[dir][typeKey].sumPlan += planned;
    crossTracker[dir][typeKey].sumReal += realized;
    if (isMade) crossTracker[dir][typeKey].made++;

    // Update by line
    const line = log.busLine || 'Onbekend';
    if (!byLine[line]) {
      byLine[line] = {
        line,
        operator: log.busOperator || 'OV',
        total: 0,
        made: 0,
        missed: 0,
        rate: 100,
        busToTrain: { total: 0, made: 0, missed: 0, rate: 100 },
        trainToBus: { total: 0, made: 0, missed: 0, rate: 100 },
        intercity: { total: 0, made: 0, missed: 0, rate: 100 },
        sprinter: { total: 0, made: 0, missed: 0, rate: 100 },
      };
    }
    const lineObj = byLine[line];
    lineObj.total++;
    if (isMade) lineObj.made++;
    else lineObj.missed++;

    if (dir === 'bus_naar_trein') {
      lineObj.busToTrain.total++;
      if (isMade) lineObj.busToTrain.made++;
      else lineObj.busToTrain.missed++;
    } else {
      lineObj.trainToBus.total++;
      if (isMade) lineObj.trainToBus.made++;
      else lineObj.trainToBus.missed++;
    }

    if (isIc) {
      lineObj.intercity.total++;
      if (isMade) lineObj.intercity.made++;
      else lineObj.intercity.missed++;
    } else {
      lineObj.sprinter.total++;
      if (isMade) lineObj.sprinter.made++;
      else lineObj.sprinter.missed++;
    }
  }

  // Calculate line rates
  for (const item of Object.values(byLine)) {
    item.rate = item.total > 0 ? Number(((item.made / item.total) * 100).toFixed(1)) : 100;
    item.busToTrain.rate =
      item.busToTrain.total > 0
        ? Number(((item.busToTrain.made / item.busToTrain.total) * 100).toFixed(1))
        : 100;
    item.trainToBus.rate =
      item.trainToBus.total > 0
        ? Number(((item.trainToBus.made / item.trainToBus.total) * 100).toFixed(1))
        : 100;
    item.intercity.rate =
      item.intercity.total > 0
        ? Number(((item.intercity.made / item.intercity.total) * 100).toFixed(1))
        : 100;
    item.sprinter.rate =
      item.sprinter.total > 0
        ? Number(((item.sprinter.made / item.sprinter.total) * 100).toFixed(1))
        : 100;
  }

  const successRate =
    totalPlanned > 0 ? Number(((transfersMade / totalPlanned) * 100).toFixed(1)) : 100;
  const avgPlannedBufferMin =
    totalPlanned > 0 ? Number((sumPlannedBuffer / totalPlanned).toFixed(1)) : 0;
  const avgRealizedMarginMin =
    totalPlanned > 0 ? Number((sumRealizedMargin / totalPlanned).toFixed(1)) : 0;

  return {
    totalPlanned,
    transfersMade,
    transfersMissed,
    successRate,
    avgPlannedBufferMin,
    avgRealizedMarginMin,
    byDirection: {
      bus_naar_trein: computeStats(
        dirTracker.bus_naar_trein.total,
        dirTracker.bus_naar_trein.made,
        dirTracker.bus_naar_trein.sumPlan,
        dirTracker.bus_naar_trein.sumReal
      ),
      trein_naar_bus: computeStats(
        dirTracker.trein_naar_bus.total,
        dirTracker.trein_naar_bus.made,
        dirTracker.trein_naar_bus.sumPlan,
        dirTracker.trein_naar_bus.sumReal
      ),
    },
    byTrainType: {
      intercity: computeStats(
        typeTracker.intercity.total,
        typeTracker.intercity.made,
        typeTracker.intercity.sumPlan,
        typeTracker.intercity.sumReal
      ),
      sprinter: computeStats(
        typeTracker.sprinter.total,
        typeTracker.sprinter.made,
        typeTracker.sprinter.sumPlan,
        typeTracker.sprinter.sumReal
      ),
    },
    byDirectionAndTrainType: {
      bus_naar_trein: {
        intercity: computeStats(
          crossTracker.bus_naar_trein.intercity.total,
          crossTracker.bus_naar_trein.intercity.made,
          crossTracker.bus_naar_trein.intercity.sumPlan,
          crossTracker.bus_naar_trein.intercity.sumReal
        ),
        sprinter: computeStats(
          crossTracker.bus_naar_trein.sprinter.total,
          crossTracker.bus_naar_trein.sprinter.made,
          crossTracker.bus_naar_trein.sprinter.sumPlan,
          crossTracker.bus_naar_trein.sprinter.sumReal
        ),
      },
      trein_naar_bus: {
        intercity: computeStats(
          crossTracker.trein_naar_bus.intercity.total,
          crossTracker.trein_naar_bus.intercity.made,
          crossTracker.trein_naar_bus.intercity.sumPlan,
          crossTracker.trein_naar_bus.intercity.sumReal
        ),
        sprinter: computeStats(
          crossTracker.trein_naar_bus.sprinter.total,
          crossTracker.trein_naar_bus.sprinter.made,
          crossTracker.trein_naar_bus.sprinter.sumPlan,
          crossTracker.trein_naar_bus.sprinter.sumReal
        ),
      },
    },
    byLine,
  };
}

/**
 * Filter connection logs by time interval ('day' | 'week' | 'month' | 'all')
 */
export function filterConnectionLogsByPeriod(
  logs: ConnectionLogEntry[],
  period: 'day' | 'week' | 'month' | 'all',
  targetDate: Date = new Date()
): ConnectionLogEntry[] {
  if (period === 'all') return logs;

  const currentInfo = getISOWeekInfo(targetDate);

  if (period === 'day') {
    return logs.filter((l) => l.date === currentInfo.dateStr);
  }
  if (period === 'week') {
    return logs.filter((l) => l.yearWeek === currentInfo.yearWeek);
  }
  if (period === 'month') {
    return logs.filter((l) => l.yearMonth === currentInfo.yearMonth);
  }
  return logs;
}

/**
 * Exports ConnectionLogEntry records to a forensic-grade UTF-8 CSV
 */
export function exportRawConnectionsToCSV(logs: ConnectionLogEntry[]): string {
  const headers = [
    'Log ID',
    'Datum',
    'Tijdstip',
    'Jaar-Maand',
    'Jaar-Week',
    'Overstap Richting',
    'Trein Soort',
    'Trein Nummer',
    'Trein Richting',
    'Trein Spoor',
    'Buslijn',
    'Bus Vervoerder',
    'Bus Bestemming',
    'Vertrekpunt / Eerste Deel',
    'Geplande Aankomst',
    'Werkelijke Aankomst',
    'Vertraging Aankomst (min)',
    'Aansluitend / Tweede Deel',
    'Gepland Vertrek',
    'Werkelijk Vertrek',
    'Vertraging Vertrek (min)',
    'Geplande Overstaptijd (min)',
    'Gerealiseerde Overstaptijd (min)',
    'Aansluiting Status',
    'Toelichting',
  ];

  const escapeCSV = (str: any) => {
    const s = String(str ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = logs.map((l) => {
    const isBusToTrain = (l.direction || 'bus_naar_trein') === 'bus_naar_trein';
    const dirLabel = isBusToTrain ? 'Bus naar Trein' : 'Trein naar Bus';
    const originLabel = isBusToTrain
      ? `Bus ${l.busLine} (${l.busOperator})`
      : `${l.trainType} ${l.trainNumber}`;
    const connectingLabel = isBusToTrain
      ? `${l.trainType} ${l.trainNumber} (${l.trainPlatform})`
      : `Bus ${l.busLine} (${l.busOperator})`;

    const plannedArr = isBusToTrain ? (l.busPlannedArrival || l.plannedOriginArrival) : (l.trainPlannedArrival || l.plannedOriginArrival);
    const actualArr = isBusToTrain ? (l.busActualArrival || l.actualOriginArrival) : (l.trainActualArrival || l.actualOriginArrival);
    const arrDelay = isBusToTrain ? l.busDelayMinutes : l.trainDelayMinutes;

    const plannedDep = isBusToTrain ? (l.trainPlannedDeparture || l.plannedConnectingDeparture) : (l.busPlannedDeparture || l.plannedConnectingDeparture);
    const actualDep = isBusToTrain ? (l.trainActualDeparture || l.actualConnectingDeparture) : (l.busActualDeparture || l.actualConnectingDeparture);
    const depDelay = isBusToTrain ? l.trainDelayMinutes : l.busDelayMinutes;

    return [
      escapeCSV(l.id),
      escapeCSV(l.date),
      escapeCSV(l.timestamp),
      escapeCSV(l.yearMonth),
      escapeCSV(l.yearWeek),
      escapeCSV(dirLabel),
      escapeCSV(l.trainType),
      escapeCSV(l.trainNumber),
      escapeCSV(l.trainDestination),
      escapeCSV(l.trainPlatform),
      escapeCSV(l.busLine),
      escapeCSV(l.busOperator),
      escapeCSV(l.busDestination),
      escapeCSV(originLabel),
      escapeCSV(plannedArr),
      escapeCSV(actualArr),
      escapeCSV(arrDelay),
      escapeCSV(connectingLabel),
      escapeCSV(plannedDep),
      escapeCSV(actualDep),
      escapeCSV(depDelay),
      escapeCSV(l.plannedTransferMinutes),
      escapeCSV(l.realizedTransferMinutes),
      escapeCSV(l.status),
      escapeCSV(l.notes || ''),
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
