export interface DRGLDeparture {
  id: string;
  time: string;
  plannedTime?: string;
  delayMinutes?: number;
  platform: string;
  lineCode: string;
  lineStyle: {
    background?: string;
    color?: string;
    borderColor?: string;
  };
  destination: string;
  category: string;
  operator: string;
  crowdLevel?: number;
  isDelayed: boolean;
  isEarly?: boolean;
  isCancelled?: boolean;
  isPlanned: boolean;
  isUnknown?: boolean;
  journeyUrl: string;
  notices: string[];
}

export interface DRGLJourneyStop {
  stopCode: string;
  name: string;
  town: string;
  time: string;
  delayMinutes?: number;
  crowdLevel?: number;
  isPassed: boolean;
  isEarly?: boolean;
  isDelayed?: boolean;
  isCancelled: boolean;
}

export interface DRGLJourneyData {
  journeyId: string;
  date: string;
  title: string;
  lineCode: string;
  destination: string;
  ritNumber: string;
  stops: DRGLJourneyStop[];
  polyLines: [number, number][];
  progressText?: string;
  vehicleCode?: string;
  currentPosition?: {
    lat: number;
    lng: number;
    speed: number;
  };
}

// Google Encoded Polyline Decoder (used by DRGL /journey/.../polyline)
export function decodePolyline(encoded: string): [number, number][] {
  const poly: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push([lat / 1e5, lng / 1e5]);
  }

  return poly;
}

function parseTimeAndDelay(rawTimeText: string, itemHtml: string): {
  cleanTime: string;
  delayMinutes: number;
  isDelayed: boolean;
  isEarly: boolean;
  isCancelled: boolean;
} {
  const timeMatch = rawTimeText.match(/(\d{2}:\d{2})/);
  const cleanTime = timeMatch ? timeMatch[1] : rawTimeText.trim();

  // Check explicit +N or -N in text
  const deltaMatch = rawTimeText.match(/([+-]\d+(?:[.,]\d+)?)/);
  let delayMinutes = deltaMatch ? parseFloat(deltaMatch[1].replace(',', '.')) : 0;

  const isDelayedClass =
    itemHtml.includes('ott-departure-delayed') ||
    itemHtml.includes('ott-call-arrivaldelayed') ||
    itemHtml.includes('ott-call-departuredelayed') ||
    itemHtml.includes('ovtt-punctuality');

  const isEarlyClass =
    itemHtml.includes('ott-departure-earlier') ||
    itemHtml.includes('ott-call-arrivalearlier') ||
    itemHtml.includes('ott-call-departurearlier');

  const isCancelled =
    itemHtml.includes('ott-departure-cancel') ||
    itemHtml.includes('ott-tripstatus-cancel') ||
    itemHtml.includes('ott-cancelled') ||
    itemHtml.includes('<del>') ||
    /vervalt|vervallen|uitgevallen/i.test(itemHtml);

  if (isDelayedClass && delayMinutes <= 0) {
    delayMinutes = 2;
  } else if (isEarlyClass && delayMinutes >= 0) {
    delayMinutes = -1;
  }

  return {
    cleanTime,
    delayMinutes,
    isDelayed: delayMinutes > 0 || isDelayedClass,
    isEarly: delayMinutes < 0 || isEarlyClass,
    isCancelled,
  };
}

// Parse DRGL /stop/NL:S:.../departurespanel HTML
export function parseDRGLDeparturesPanel(html: string): {
  title: string;
  departures: DRGLDeparture[];
} {
  const titleMatch = html.match(/<h3 class="panel-title">([\s\S]*?)<\/h3>/);
  const title = titleMatch
    ? titleMatch[1]
        .replace('&dash;', '—')
        .replace(/&#x27;/g, "'")
        .replace(/<[^>]+>/g, '')
        .trim()
    : 'Steenwijk — Vertrektijden';

  const departures: DRGLDeparture[] = [];
  const itemRegex = /<a href="(\/journey\/[^"]+)" class="list-group-item">([\s\S]*?)<\/a>/g;

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(html)) !== null) {
    const journeyUrl = match[1];
    const itemHtml = match[2];

    const timeMatch = itemHtml.match(/<div class="ott-departure-time([^"]*)">([\s\S]*?)<\/div>/);
    const timeClasses = timeMatch ? timeMatch[1] : '';
    const timeText = timeMatch ? timeMatch[2].replace(/<[^>]+>/g, '').trim() : '';

    const parsedTiming = parseTimeAndDelay(timeText, itemHtml);
    const isPlanned = timeClasses.includes('planned');
    const isUnknown = timeClasses.includes('unknown') || timeText.includes('?');

    const platformMatch = itemHtml.match(/<div class="ott-platform[^"]*">([\s\S]*?)<\/div>/);
    const platform = platformMatch ? platformMatch[1].trim() : '';

    const lineMatch = itemHtml.match(
      /<div class="ott-linecode[^"]*"(?:\s+style="([^"]*)")?>([\s\S]*?)<\/div>/
    );
    const styleStr = lineMatch && lineMatch[1] ? lineMatch[1] : '';
    const lineCode = lineMatch && lineMatch[2] ? lineMatch[2].trim() : '';

    const bgMatch = styleStr.match(/background:\s*([^;]+)/);
    const colorMatch = styleStr.match(/(?:^|;|\s)color:\s*([^;]+)/);
    const borderMatch = styleStr.match(/border-color:\s*([^;]+)/);

    const destMatch = itemHtml.match(/<div class="ott-destination">([\s\S]*?)<\/div>/);
    const destination = destMatch
      ? destMatch[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim()
      : '';

    const prodMatch = itemHtml.match(/<div class="ott-productcategory">([\s\S]*?)<\/div>/);
    let category = 'Bus';
    let operator = 'RRReis';
    let crowdLevel: number | undefined = undefined;

    if (prodMatch) {
      const prodHtml = prodMatch[1];
      const crowdMatch = prodHtml.match(/crowd(\d)\.svg/);
      if (crowdMatch) {
        crowdLevel = parseInt(crowdMatch[1], 10);
      }
      const cleanProd = prodHtml
        .replace(/<[^>]+>/g, '')
        .replace('&bull;', '•')
        .trim();
      const parts = cleanProd.split('•').map((s) => s.trim());
      if (parts.length >= 2) {
        category = parts[0];
        operator = parts[1];
      } else if (parts.length === 1 && parts[0]) {
        operator = parts[0];
      }
    }

    const notices: string[] = [];
    const noticeRegex = /<div class="notice[^"]*">([\s\S]*?)<\/div>/g;
    let nMatch: RegExpExecArray | null;
    while ((nMatch = noticeRegex.exec(itemHtml)) !== null) {
      const nText = nMatch[1].replace(/<[^>]+>/g, '').trim();
      if (nText) notices.push(nText);
    }

    departures.push({
      id: journeyUrl,
      time: timeText || parsedTiming.cleanTime,
      plannedTime: parsedTiming.cleanTime,
      delayMinutes: parsedTiming.delayMinutes,
      platform,
      lineCode,
      lineStyle: {
        background: bgMatch ? bgMatch[1].trim() : undefined,
        color: colorMatch ? colorMatch[1].trim() : undefined,
        borderColor: borderMatch ? borderMatch[1].trim() : undefined,
      },
      destination,
      category,
      operator,
      crowdLevel,
      isDelayed: parsedTiming.isDelayed,
      isEarly: parsedTiming.isEarly,
      isCancelled: parsedTiming.isCancelled,
      isPlanned,
      isUnknown,
      journeyUrl,
      notices,
    });
  }

  return { title, departures };
}

// Parse DRGL /journey/EBS:4214:1009/20261019/ HTML
export function parseDRGLJourneyPage(html: string, journeyUrl: string): DRGLJourneyData {
  const parts = journeyUrl.replace(/^\/journey\//, '').replace(/\/$/, '').split('/');
  const journeyId = parts[0] || '';
  const date = parts[1] || '';

  const titleMatch = html.match(/<h3 class="panel-title">([\s\S]*?)<\/h3>/);
  const fullTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  const headerParts = fullTitle.match(/^(\S+)\s+richting\s+(.+?)\s+rit\s+(\S+)$/i);
  const lineCode = headerParts ? headerParts[1] : journeyId.split(':')[1] || '';
  const destination = headerParts ? headerParts[2] : fullTitle;
  const ritNumber = headerParts ? headerParts[3] : journeyId.split(':')[2] || '';

  const stops: DRGLJourneyStop[] = [];
  const itemRegex = /<a href="\/stop\/([^"]+)" class="list-group-item">([\s\S]*?)<\/a>/g;

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(html)) !== null) {
    const stopCode = match[1];
    const itemHtml = match[2];

    const timeMatch = itemHtml.match(/<span class="ott-call-arrivaltime[^"]*">([\s\S]*?)<\/span>/);
    const rawTime = timeMatch ? timeMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const parsedTiming = parseTimeAndDelay(rawTime, itemHtml);

    const nameBlockMatch = itemHtml.match(/<div class="row col-md-8 col-xs-8">([\s\S]*?)<\/div>/);
    let fullStopName = '';
    let crowdLevel: number | undefined = undefined;

    if (nameBlockMatch) {
      const blockHtml = nameBlockMatch[1];
      const crowdMatch = blockHtml.match(/crowd(\d)\.svg/);
      if (crowdMatch) {
        crowdLevel = parseInt(crowdMatch[1], 10);
      }
      fullStopName = blockHtml
        .replace(/<[^>]+>/g, '')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();
    }

    const commaIdx = fullStopName.lastIndexOf(',');
    const name = commaIdx > -1 ? fullStopName.slice(0, commaIdx).trim() : fullStopName;
    const town = commaIdx > -1 ? fullStopName.slice(commaIdx + 1).trim() : '';

    stops.push({
      stopCode,
      name,
      town,
      time: rawTime || parsedTiming.cleanTime,
      delayMinutes: parsedTiming.delayMinutes,
      crowdLevel,
      isPassed: itemHtml.includes('ott-tripstatus-arrived'),
      isEarly: parsedTiming.isEarly,
      isDelayed: parsedTiming.isDelayed,
      isCancelled: parsedTiming.isCancelled,
    });
  }

  return {
    journeyId,
    date,
    title: fullTitle,
    lineCode,
    destination,
    ritNumber,
    stops,
    polyLines: [],
  };
}
