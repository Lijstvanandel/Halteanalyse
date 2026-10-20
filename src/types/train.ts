export interface TrainPosition {
  id: string; // e.g. "NS:836"
  matnummer: string; // e.g. "836"
  operator: 'NS';
  operatorName: string; // "Nederlandse Spoorwegen"
  line: string; // "Intercity" | "Sprinter"
  trainType: 'Intercity' | 'Sprinter';
  destination: string; // e.g. "Schiphol Airport", "Leeuwarden", "Rotterdam Centraal"
  origin: string; // e.g. "Leeuwarden", "Zwolle"
  lat: number;
  lng: number;
  speedKmH: number;
  heading: number;
  delayMinutes: number;
  delaySeconds: number;
  status: 'Rijdend' | 'Halteert' | 'Vertraagd';
  platform?: string; // "1" | "2" | "Spoor 1" | "Spoor 2"
  lastUpdated: string;
  nextStation?: string;
}

export type ConnectionStatus = 'gehaald' | 'gemist';
export type TransferDirection = 'bus_naar_trein' | 'trein_naar_bus';

export interface ConnectionLogEntry {
  id: string;
  direction: TransferDirection; // 'bus_naar_trein' | 'trein_naar_bus'
  timestamp: string;
  date: string; // "YYYY-MM-DD"
  yearMonth: string; // "YYYY-MM"
  isoYear: number;
  isoWeek: number;
  yearWeek: string; // "YYYY-Www"
  
  // Bus details
  busLine: string;
  busOperator: string;
  busDestination: string;
  busPlannedArrival?: string; // "HH:MM" (when bus is inbound)
  busActualArrival?: string;
  busPlannedDeparture?: string; // "HH:MM" (when bus is outbound)
  busActualDeparture?: string;
  busDelayMinutes: number;
  
  // Train details
  trainNumber: string;
  trainType: 'Intercity' | 'Sprinter';
  trainDestination: string;
  trainOrigin?: string;
  trainPlatform: string;
  trainPlannedDeparture?: string; // "HH:MM" (when train is outbound)
  trainActualDeparture?: string;
  trainPlannedArrival?: string; // "HH:MM" (when train is inbound)
  trainActualArrival?: string;
  trainDelayMinutes: number;
  
  // Normalized transfer metrics
  originVehicle: string; // e.g. "Bus 70" or "Intercity 836"
  connectingVehicle: string; // e.g. "Intercity 836" or "Bus 70"
  plannedOriginArrival: string; // "HH:MM"
  actualOriginArrival: string; // "HH:MM"
  plannedConnectingDeparture: string; // "HH:MM"
  actualConnectingDeparture: string; // "HH:MM"

  plannedTransferMinutes: number; // 3 to 15 minutes
  realizedTransferMinutes: number; // actual connecting departure - actual origin arrival
  status: ConnectionStatus; // 'gehaald' | 'gemist'
  notes?: string;
}

export interface DirectionStats {
  total: number;
  made: number;
  missed: number;
  rate: number;
  avgPlannedBufferMin: number;
  avgRealizedMarginMin: number;
}

export interface ConnectionSummary {
  totalPlanned: number;
  transfersMade: number;
  transfersMissed: number;
  successRate: number; // percentage 0-100
  avgPlannedBufferMin: number;
  avgRealizedMarginMin: number;

  byDirection: {
    bus_naar_trein: DirectionStats;
    trein_naar_bus: DirectionStats;
  };

  byTrainType: {
    intercity: DirectionStats;
    sprinter: DirectionStats;
  };

  byDirectionAndTrainType: {
    bus_naar_trein: {
      intercity: DirectionStats;
      sprinter: DirectionStats;
    };
    trein_naar_bus: {
      intercity: DirectionStats;
      sprinter: DirectionStats;
    };
  };

  byLine: Record<
    string,
    {
      line: string;
      operator: string;
      total: number;
      made: number;
      missed: number;
      rate: number;
      busToTrain: { total: number; made: number; missed: number; rate: number };
      trainToBus: { total: number; made: number; missed: number; rate: number };
      intercity: { total: number; made: number; missed: number; rate: number };
      sprinter: { total: number; made: number; missed: number; rate: number };
    }
  >;
}
