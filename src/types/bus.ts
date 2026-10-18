export type OperatorCode = 'EBS' | 'RRReis' | 'ARR' | 'QBZ' | 'KEO' | 'CXX' | 'OVCN';

export interface BusPosition {
  id: string;
  matnummer: string; // e.g. "2084"
  operator: OperatorCode;
  operatorName: string;
  line: string; // e.g. "70", "270", "76", "75"
  destination: string; // e.g. "Steenwijk Station", "Zwartsluis", "Giethoorn"
  origin: string;
  lat: number;
  lng: number;
  speedKmH: number;
  heading: number; // 0-360 degrees
  delayMinutes: number; // e.g. 0, 2, -1
  color: string; // icon file reference e.g. "ebs.png"
  busType: 'Elektrisch' | 'Diesel' | 'Hybride';
  model: string; // e.g. "BYD eBus B12 12m", "Mercedes Citaro C2 LE"
  licensePlate: string;
  status: 'In dienst' | 'Halteert' | 'Rijdend' | 'Vertraagd';
  lastUpdated: string;
  nextStop?: string;
  estimatedArrivalNextStop?: string;
  occupancyPercent?: number;
  stops?: {
    name: string;
    lat: number;
    lng: number;
    time: string;
    passed: boolean;
  }[];
}

export interface BusStopRouteDetail {
  line: string;
  color: string;
  description: string;
}

export interface BusStop {
  id: string;
  stopCode?: string;
  name: string;
  town: string;
  lat: number;
  lng: number;
  lines: string[];
  routeDetails?: BusStopRouteDetail[];
  direction?: string;
  url?: string;
}

export interface BuspositiesGeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lat, lng] as in busposities.nl
  };
  properties: {
    matnummer: string;
    color: string;
    richting: number;
    meerinfo?: string;
    line?: string;
    operator?: string;
    destination?: string;
    speed?: number;
    delay?: number;
  };
}

export interface BuspositiesGeoJSONResponse {
  type: 'FeatureCollection';
  features: BuspositiesGeoJSONFeature[];
}

export interface SyncStatus {
  source: 'busposities.nl (live)' | 'busposities.nl (via proxy)' | 'actieve feed Steenwijkerland';
  lastSyncTime: Date;
  activeCount: number;
  inSteenwijkerlandCount: number;
  isPolling: boolean;
  error?: string | null;
}
