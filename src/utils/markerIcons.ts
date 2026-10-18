import L from 'leaflet';
import { BusPosition } from '../types/bus';

/**
 * Creates the authentic DRGL.nl vehicle marker:
 * - Circle with #ffcc00 (gold) fill and #0e518d (DRGL navy) stroke
 * - Speed (km/h) displayed inside the circle
 * - Heading direction pointer
 * - Official line badge and material number
 */
export function createBusMarkerIcon(bus: BusPosition, isSelected = false): L.DivIcon {
  const isDelayed = bus.delayMinutes > 2;
  const delayColor = isDelayed ? '#dc2626' : bus.delayMinutes < 0 ? '#16a34a' : '#0e518d';
  const delayBadge = bus.delayMinutes > 0 ? `+${bus.delayMinutes}m` : bus.delayMinutes < 0 ? `${bus.delayMinutes}m` : 'op tijd';

  // DRGL Line Color
  let lineBg = '#0e518d';
  let lineText = '#ffffff';
  let lineBorder = '#0e518d';

  if (bus.line === '70') {
    lineBg = '#00965e'; // RRReis green
    lineBorder = '#00965e';
  } else if (bus.line === '214' || bus.line === '270') {
    lineBg = '#0086d6'; // snelRRReis blue
    lineBorder = '#0086d6';
  } else if (['18', '20', '26', '524', '40'].includes(bus.line)) {
    lineBg = '#ffffff';
    lineText = '#1e293b';
    lineBorder = '#b6b6b6'; // Qbuzz style
  }

  const html = `
    <div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
      <!-- Glow if selected -->
      ${isSelected ? `<div class="absolute -inset-2 rounded-full bg-[#ffcc00]/40 animate-ping"></div>` : ''}

      <!-- Heading Direction Triangle -->
      <div style="transform: rotate(${bus.heading}deg); transform-origin: center center;" class="bus-marker-container flex items-center justify-center">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-lg">
          <!-- Direction Arrow Pointer -->
          <polygon points="22,3 28,15 16,15" fill="#0e518d" stroke="#ffcc00" stroke-width="1.5" />
          
          <!-- DRGL Yellow Circle (#ffcc00) with #0e518d stroke -->
          <circle cx="22" cy="24" r="14" fill="#ffcc00" stroke="#0e518d" stroke-width="3" />
        </svg>

        <!-- Speed displayed in center of DRGL circle -->
        <span class="absolute text-[11px] font-bold font-mono text-slate-950 pointer-events-none tabular-nums" style="top: 17px;">
          ${bus.speedKmH}
        </span>
      </div>

      <!-- Line & Bus Identifier Badge -->
      <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center shadow-md rounded px-1.5 py-0.5 bg-white border border-slate-300 whitespace-nowrap z-10 pointer-events-none">
        <span class="text-[10px] font-bold px-1 rounded mr-1" style="background-color: ${lineBg}; color: ${lineText}; border: 1px solid ${lineBorder};">
          ${bus.line}
        </span>
        <span class="text-[9px] font-mono font-semibold text-slate-700">#${bus.matnummer}</span>
      </div>

      <!-- Delay Pill -->
      <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shadow-sm bg-white border text-slate-900 pointer-events-none" style="border-color: ${delayColor};">
        <span style="color: ${delayColor};">${delayBadge}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-drgl-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
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
