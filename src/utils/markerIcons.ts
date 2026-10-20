import L from 'leaflet';
import { BusPosition } from '../types/bus';

const RRREIS_LINES = new Set(['214', '270', '70', '76']);
const QBUZZ_LINES = new Set(['217', '20', '18', '524', '26']);

/**
 * Returns the exact marker image filename ('RRREIS.png' or 'QBUZZ.png') for a given bus line & operator:
 * - Lijn 214, 270, 70, 76 -> RRREIS.png
 * - Lijn 217, 20, 18, 524, 26 -> QBUZZ.png
 */
export function getVehicleMarkerImage(
  line: string,
  operator?: string,
  operatorName?: string
): 'RRREIS.png' | 'QBUZZ.png' {
  const cleanLine = String(line || '').trim();
  if (RRREIS_LINES.has(cleanLine)) {
    return 'RRREIS.png';
  }
  if (QBUZZ_LINES.has(cleanLine)) {
    return 'QBUZZ.png';
  }
  const opUpper = `${operator || ''} ${operatorName || ''}`.toUpperCase();
  if (opUpper.includes('QBZ') || opUpper.includes('QBUZZ')) {
    return 'QBUZZ.png';
  }
  return 'RRREIS.png';
}

/**
 * Creates the vehicle marker using RRREIS.png (lines 214, 270, 70, 76)
 * or QBUZZ.png (lines 217, 20, 18, 524, 26), with directional heading pointer,
 * line badge, vehicle number, and punctuality badge in Premium Forensic Dark style.
 */
export function createBusMarkerIcon(bus: BusPosition, isSelected = false): L.DivIcon {
  const isDelayed = bus.delayMinutes > 1;
  const delayColor = isDelayed ? '#ef4444' : bus.delayMinutes < 0 ? '#38bdf8' : '#10b981';
  const delayBadge =
    bus.delayMinutes > 0
      ? `+${bus.delayMinutes}m`
      : bus.delayMinutes < 0
      ? `${bus.delayMinutes}m`
      : 'op tijd';

  const markerImage = getVehicleMarkerImage(bus.line, bus.operator, bus.operatorName);
  const isQbuzz = markerImage === 'QBUZZ.png';

  const pointerColor = isQbuzz ? '#f59e0b' : '#10b981';
  const pointerStroke = '#f5f6f4';

  const html = `
    <div class="relative group cursor-pointer select-none tabular-nums" style="width: 48px; height: 48px; transform: translate(-50%, -50%);">
      <!-- Selection frame (Zero-Pill architectural square) -->
      ${
        isSelected
          ? `<div class="absolute -inset-2 rounded-[5px] border-2 border-[#f59e0b] bg-[#f59e0b]/15 pointer-events-none"></div>`
          : ''
      }

      <!-- Rotated direction pointer -->
      <div
        style="transform: rotate(${bus.heading || 0}deg); transform-origin: center center;"
        class="w-12 h-12 flex items-center justify-center pointer-events-none"
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="24,1 30,12 18,12" fill="${pointerColor}" stroke="${pointerStroke}" stroke-width="1.5" />
        </svg>
      </div>

      <!-- Official RRREIS.png / QBUZZ.png Vehicle Marker Image -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="top: 4px;">
        <img
          src="/${markerImage}"
          alt="${markerImage}"
          class="w-9 h-9 object-contain drop-shadow-md rounded-[4px]"
          draggable="false"
        />
      </div>

      <!-- Line & Bus Identifier Badge -->
      <div class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 flex items-center shadow-md rounded-[4px] px-1.5 py-0.5 bg-[#0b1a13] border border-[#1b3829] whitespace-nowrap z-10 pointer-events-none tabular-nums">
        <span
          class="text-[10px] font-bold px-1 rounded-[3px] mr-1 leading-tight bg-[#f59e0b] text-[#060e0a]"
        >
          ${bus.line}
        </span>
        <span class="text-[9px] font-mono font-semibold text-[#f5f6f4] tabular-nums">#${bus.matnummer}</span>
      </div>

      <!-- Delay Tag -->
      <div
        class="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-[3px] shadow-sm bg-[#0b1a13] border whitespace-nowrap pointer-events-none tabular-nums"
        style="border-color: ${delayColor}; color: ${delayColor};"
      >
        <span>${delayBadge}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-drgl-marker',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
}

/**
 * DRGL Bus Stop (Halte) Icon — Zero-Pill Architectural Square
 */
export function createHalteIcon(): L.DivIcon {
  const html = `
    <div class="relative cursor-pointer group" style="transform: translate(-50%, -50%);">
      <div class="w-5 h-5 rounded-[4px] bg-[#0b1a13] border border-[#437257] flex items-center justify-center shadow-md hover:border-[#f59e0b] transition-colors">
        <span class="text-[10px] font-extrabold text-[#f59e0b]">H</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-drgl-halte',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
}

/**
 * GPS location marker — Zero-Pill Architectural Square
 */
export function createGpsLocationIcon(): L.DivIcon {
  const html = `
    <div class="relative flex items-center justify-center" style="transform: translate(-50%, -50%);">
      <div class="w-4 h-4 rounded-[3px] bg-[#38bdf8] border border-[#f5f6f4] shadow-lg"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-gps-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

/**
 * Deelfiets Nederland Hub Marker Icon — Premium Forensic Dark
 */
export function createDeelfietsIcon(
  available: number,
  capacity: number,
  isCargoBike = false
): L.DivIcon {
  const hasBikes = available > 0;
  const bg = '#0b1a13';
  const border = hasBikes ? '#38bdf8' : '#ef4444';
  const textColor = hasBikes ? '#38bdf8' : '#ef4444';

  const html = `
    <div class="relative cursor-pointer group select-none tabular-nums" style="transform: translate(-50%, -50%);">
      <div
        class="w-7 h-7 rounded-[4px] border flex items-center justify-center shadow-lg transition-transform"
        style="background-color: ${bg}; border-color: ${border};"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${textColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="18.5" cy="17.5" r="3.5" />
          <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
        </svg>
      </div>
      <div
        class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-[3px] text-[9px] font-mono font-bold shadow border whitespace-nowrap pointer-events-none tabular-nums"
        style="background-color: #060e0a; color: ${textColor}; border-color: #1b3829;"
      >
        ${isCargoBike ? 'Bak ' : ''}${available}/${capacity}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-deelfiets-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

/**
 * Official NS OV-fiets Station Steenwijk marker using 'bicycle_parking_open.png'
 */
export function createOvFietsMarkerIcon(
  available: number,
  capacity: number = 33
): L.DivIcon {
  const hasBikes = available > 0;
  const countColor = hasBikes ? '#fbbf24' : '#ef4444';
  const badgeBg = '#060e0a';
  const badgeBorder = hasBikes ? '#f59e0b' : '#ef4444';

  const html = `
    <div class="relative cursor-pointer group select-none tabular-nums" style="width: 36px; height: 44px; transform: translate(-50%, -100%);">
      <img
        src="/bicycle_parking_open.png"
        alt="OV-fiets Station Steenwijk"
        class="w-8 h-9 object-contain drop-shadow-md mx-auto block"
        draggable="false"
      />
      <div
        class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-[3px] text-[9px] font-mono font-extrabold shadow border whitespace-nowrap pointer-events-none tabular-nums"
        style="background-color: ${badgeBg}; color: ${countColor}; border-color: ${badgeBorder};"
      >
        ${available}/${capacity}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-ovfiets-marker',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

/**
 * Official NS Train Marker Icon using 'NS.png' (matching RRREIS.png and QBUZZ.png)
 * Keeps 'IC' and 'Sprinter' labels visible in the marker badge.
 * Premium Forensic Dark style (Zero-Pill discipline, tabular-nums)
 */
export function createTrainMarkerIcon(
  train: {
    line: string;
    matnummer: string;
    heading: number;
    delayMinutes: number;
    destination: string;
    speedKmH: number;
  },
  isSelected = false
): L.DivIcon {
  const isDelayed = train.delayMinutes > 1;
  const delayColor = isDelayed ? '#ef4444' : train.delayMinutes < 0 ? '#38bdf8' : '#10b981';
  const delayBadge =
    train.delayMinutes > 0
      ? `+${train.delayMinutes}m`
      : train.delayMinutes < 0
      ? `${train.delayMinutes}m`
      : 'op tijd';

  const isSprinter = train.line.toLowerCase().includes('sprinter');
  const typeCode = isSprinter ? 'Sprinter' : 'IC';
  const pointerColor = '#38bdf8';
  const pointerStroke = '#f5f6f4';

  const html = `
    <div class="relative group cursor-pointer select-none tabular-nums" style="width: 48px; height: 48px; transform: translate(-50%, -50%);">
      <!-- Selection frame (Zero-Pill architectural square) -->
      ${
        isSelected
          ? `<div class="absolute -inset-2 rounded-[5px] border-2 border-[#38bdf8] bg-[#38bdf8]/15 pointer-events-none"></div>`
          : ''
      }

      <!-- Rotated direction pointer -->
      <div
        style="transform: rotate(${train.heading || 0}deg); transform-origin: center center;"
        class="w-12 h-12 flex items-center justify-center pointer-events-none"
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="24,1 29,11 19,11" fill="${pointerColor}" stroke="${pointerStroke}" stroke-width="1.5" />
        </svg>
      </div>

      <!-- Official NS.png Train Marker Image -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="top: 4px;">
        <img
          src="/NS.png"
          alt="NS Trein"
          class="w-9 h-9 object-contain drop-shadow-md rounded-[4px]"
          draggable="false"
        />
      </div>

      <!-- Train Series (IC / Sprinter) & Material Number Tag -->
      <div class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 flex items-center shadow-md rounded-[4px] px-1.5 py-0.5 bg-[#0b1a13] border border-[#1b3829] whitespace-nowrap z-10 pointer-events-none tabular-nums">
        <span class="text-[9px] font-bold px-1 rounded-[3px] mr-1 leading-tight ${
          isSprinter ? 'bg-[#0284c7] text-[#f5f6f4]' : 'bg-[#eab308] text-[#060e0a]'
        }">
          ${typeCode}
        </span>
        <span class="text-[9px] font-mono font-bold text-[#f5f6f4] tabular-nums">#${train.matnummer}</span>
      </div>

      <!-- Delay Tag -->
      <div
        class="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-[3px] shadow-sm bg-[#060e0a] border whitespace-nowrap pointer-events-none tabular-nums"
        style="border-color: ${delayColor}; color: ${delayColor};"
      >
        <span>${delayBadge}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-train-marker',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
}

