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
 * line badge, vehicle number, and punctuality badge.
 */
export function createBusMarkerIcon(bus: BusPosition, isSelected = false): L.DivIcon {
  const isDelayed = bus.delayMinutes > 1;
  const delayColor = isDelayed ? '#dc2626' : bus.delayMinutes < 0 ? '#0284c7' : '#16a34a';
  const delayBadge =
    bus.delayMinutes > 0
      ? `+${bus.delayMinutes}m`
      : bus.delayMinutes < 0
      ? `${bus.delayMinutes}m`
      : 'op tijd';

  const markerImage = getVehicleMarkerImage(bus.line, bus.operator, bus.operatorName);
  const isQbuzz = markerImage === 'QBUZZ.png';

  // Badge styling per line/operator
  let lineBg = isQbuzz ? '#dc3545' : '#00965e';
  const lineText = '#ffffff';
  let lineBorder = isQbuzz ? '#b91c1c' : '#047857';

  if (bus.line === '214' || bus.line === '270') {
    lineBg = '#0086d6'; // snelRRReis blue
    lineBorder = '#0369a1';
  } else if (bus.line === '76') {
    lineBg = '#0d9488';
    lineBorder = '#0f766e';
  } else if (bus.line === '20' || bus.line === '524') {
    lineBg = '#ea580c';
    lineBorder = '#c2410c';
  } else if (bus.line === '217') {
    lineBg = '#d97706';
    lineBorder = '#b45309';
  }

  const pointerColor = isQbuzz ? '#dc3545' : '#0e518d';
  const pointerStroke = isQbuzz ? '#ffcc00' : '#ffffff';

  const html = `
    <div class="relative group cursor-pointer select-none" style="width: 48px; height: 48px; transform: translate(-50%, -50%);">
      <!-- Selection halo -->
      ${
        isSelected
          ? `<div class="absolute -inset-2 rounded-full border-2 border-[#FFCC00] bg-[#FFCC00]/30 animate-pulse pointer-events-none"></div>`
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
          class="w-9 h-9 object-contain drop-shadow-md rounded-full"
          draggable="false"
        />
      </div>

      <!-- Line & Bus Identifier Badge -->
      <div class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 flex items-center shadow-md rounded px-1.5 py-0.5 bg-white border border-slate-300 whitespace-nowrap z-10 pointer-events-none">
        <span
          class="text-[10px] font-bold px-1 rounded mr-1 leading-tight"
          style="background-color: ${lineBg}; color: ${lineText}; border: 1px solid ${lineBorder};"
        >
          ${bus.line}
        </span>
        <span class="text-[9px] font-mono font-semibold text-slate-800">#${bus.matnummer}</span>
      </div>

      <!-- Delay Pill -->
      <div
        class="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shadow-sm bg-white border text-slate-900 whitespace-nowrap pointer-events-none"
        style="border-color: ${delayColor};"
      >
        <span style="color: ${delayColor};">${delayBadge}</span>
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
 * DRGL Bus Stop (Halte) Icon
 */
export function createHalteIcon(): L.DivIcon {
  const html = `
    <div class="relative cursor-pointer group" style="transform: translate(-50%, -50%);">
      <div class="w-6 h-6 rounded-full bg-[#0E518D] border-2 border-white flex items-center justify-center shadow-md hover:scale-125 transition-transform">
        <span class="text-[10px] font-black text-[#FFCC00]">H</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-drgl-halte',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

/**
 * GPS location marker
 */
export function createGpsLocationIcon(): L.DivIcon {
  const html = `
    <div class="relative flex items-center justify-center" style="transform: translate(-50%, -50%);">
      <div class="w-4 h-4 rounded-full bg-[#0E518D] border-2 border-[#FFCC00] shadow-lg"></div>
      <div class="absolute w-8 h-8 rounded-full bg-[#0E518D]/30 animate-ping"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-gps-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/**
 * Deelfiets Nederland Hub Marker Icon (#00B1FF cyan/blue with #FFE364 accent when available)
 */
export function createDeelfietsIcon(
  available: number,
  capacity: number,
  isCargoBike = false
): L.DivIcon {
  const hasBikes = available > 0;
  const bg = hasBikes ? '#00B1FF' : '#64748b';
  const border = hasBikes ? '#FFE364' : '#cbd5e1';

  const html = `
    <div class="relative cursor-pointer group select-none" style="transform: translate(-50%, -50%);">
      <div
        class="w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        style="background-color: ${bg}; border-color: ${border};"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="18.5" cy="17.5" r="3.5" />
          <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
        </svg>
      </div>
      <div
        class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shadow border whitespace-nowrap pointer-events-none"
        style="background-color: ${hasBikes ? '#ffffff' : '#fef2f2'}; color: ${
    hasBikes ? '#0369a1' : '#dc2626'
  }; border-color: ${hasBikes ? '#00B1FF' : '#fca5a5'};"
      >
        ${isCargoBike ? 'Bak ' : ''}${available}/${capacity}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-deelfiets-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

/**
 * Official NS OV-fiets Station Steenwijk marker using 'bicycle_parking_open.png'
 * As requested: marker on Station Steenwijk with 'bicycle_parking_open.png'
 */
export function createOvFietsMarkerIcon(
  available: number,
  capacity: number = 33
): L.DivIcon {
  const hasBikes = available > 0;
  const countColor = hasBikes ? '#000066' : '#dc2626';
  const badgeBg = hasBikes ? '#FFCC00' : '#fee2e2';
  const badgeBorder = hasBikes ? '#000066' : '#ef4444';

  const html = `
    <div class="relative cursor-pointer group select-none hover:scale-110 transition-transform" style="width: 36px; height: 44px; transform: translate(-50%, -100%);">
      <!-- bicycle_parking_open.png custom icon -->
      <img
        src="/bicycle_parking_open.png"
        alt="OV-fiets Station Steenwijk"
        class="w-8 h-9 object-contain drop-shadow-md mx-auto block"
        draggable="false"
      />
      <!-- Live availability badge -->
      <div
        class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded text-[9px] font-mono font-black shadow border whitespace-nowrap pointer-events-none"
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

