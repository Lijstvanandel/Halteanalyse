import React from 'react';
import { BusPosition } from '../types/bus';
import { getVehicleMarkerImage } from '../utils/markerIcons';
import {
  X,
  Gauge,
  Compass,
  Clock,
  Zap,
  MapPin,
  ExternalLink,
  Navigation,
  CheckCircle2,
} from 'lucide-react';

interface BusDetailModalProps {
  bus: BusPosition | null;
  onClose: () => void;
  isFollowing: boolean;
  onToggleFollow: () => void;
}

export const BusDetailModal: React.FC<BusDetailModalProps> = ({
  bus,
  onClose,
  isFollowing,
  onToggleFollow,
}) => {
  if (!bus) return null;

  const markerPng = getVehicleMarkerImage(bus.line, bus.operator, bus.operatorName);
  const delaySec =
    bus.delaySeconds !== undefined ? bus.delaySeconds : Math.round(bus.delayMinutes * 60);
  const isDelayed = delaySec > 60 || bus.delayMinutes > 1;
  const isEarly = delaySec < -60 || bus.delayMinutes < -1;

  const formatPunctualityText = () => {
    if (Math.abs(delaySec) < 60 && Math.abs(bus.delayMinutes) < 1) {
      return 'Op tijd';
    }
    const absSec = Math.abs(delaySec);
    const mm = Math.floor(absSec / 60);
    const ss = String(absSec % 60).padStart(2, '0');
    if (delaySec > 0) {
      return `+${mm}:${ss} min later`;
    }
    return `-${mm}:${ss} min vroeger`;
  };

  const getCompassDirection = (deg: number): string => {
    const directions = [
      'N',
      'NNO',
      'NO',
      'ONO',
      'O',
      'OZO',
      'ZO',
      'ZZO',
      'Z',
      'ZZW',
      'ZW',
      'WZW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    const idx = Math.round(((deg || 0) % 360) / 22.5) % 16;
    return directions[idx];
  };

  return (
    <aside className="fixed inset-x-0 bottom-0 top-14 md:static md:w-[380px] lg:w-[410px] h-[calc(100vh-3.5rem)] md:h-full z-[600] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between text-slate-100 shrink-0 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950/60">
        <div className="flex items-start gap-3 min-w-0">
          <img
            src={`/${markerPng}`}
            alt={markerPng}
            className="w-10 h-10 rounded-full object-contain shrink-0 border border-slate-700 bg-slate-800 p-0.5 shadow-md"
          />
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-1.5 mb-1">
              <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-sky-500 text-white shadow-sm">
                {bus.operatorName} {bus.line}
              </span>
              <span className="text-xs font-mono font-bold text-[#FFCC00]">
                Bus {bus.matnummer}
              </span>
              {bus.ritnummer && (
                <span className="text-xs font-mono text-slate-400">
                  • Rit {bus.ritnummer}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-white tracking-tight leading-snug truncate">
              → {bus.destination}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              Van: {bus.origin}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold shrink-0 shadow-sm"
          title="Overzicht sluiten (Esc)"
        >
          <X className="w-4 h-4" />
          <span>Sluiten</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-4 overflow-y-auto space-y-4 flex-1">
        {/* Status Strip */}
        <div className="grid grid-cols-3 gap-2">
          {/* Speed */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              <span>Snelheid</span>
            </div>
            <div className="text-base font-bold font-mono text-white tabular-nums">
              {bus.speedKmH} <span className="text-xs font-normal text-slate-400">km/u</span>
            </div>
          </div>

          {/* Heading */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Richting</span>
            </div>
            <div className="text-base font-bold font-mono text-white tabular-nums">
              {bus.heading}°{' '}
              <span className="text-xs font-normal text-slate-400">
                {getCompassDirection(bus.heading)}
              </span>
            </div>
          </div>

          {/* Delay */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Punctualiteit</span>
            </div>
            <div
              className={`text-sm font-bold font-mono tabular-nums ${
                isDelayed ? 'text-red-400' : isEarly ? 'text-sky-400' : 'text-emerald-400'
              }`}
            >
              {formatPunctualityText()}
            </div>
          </div>
        </div>

        {/* OVzoeker / Bus Specification Card */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/60">
            <span className="font-semibold text-slate-300">
              Live Voertuiggegevens (OVzoeker / GTFS-RT)
            </span>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 font-medium">{bus.busType}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Voertuignummer:</span>
            <span className="font-mono font-bold text-white">
              Bus {bus.matnummer} ({bus.ovzoekerId || `${bus.operator}:${bus.matnummer}`})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Kaartmarker:</span>
            <span className="font-mono text-slate-300 flex items-center gap-1.5">
              <img src={`/${markerPng}`} alt={markerPng} className="w-4 h-4 object-contain" />
              {markerPng}
            </span>
          </div>

          {bus.ritnummer && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ritnummer:</span>
              <span className="font-mono text-slate-200 font-semibold">Rit {bus.ritnummer}</span>
            </div>
          )}

          {bus.omloopnummer && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Omloopnummer:</span>
              <span className="font-mono text-slate-200 font-semibold">{bus.omloopnummer}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status:</span>
            <span className="font-medium text-slate-200 flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  bus.status === 'Rijdend' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {bus.status}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Live GPS-coördinaten:</span>
            <span className="font-mono text-slate-400 tabular-nums">
              {bus.lat.toFixed(5)}, {bus.lng.toFixed(5)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">Laatste GPS-update:</span>
            <span className="font-mono text-slate-300 tabular-nums">{bus.lastUpdated}</span>
          </div>
        </div>

        {/* Route Stops / Dienstregeling */}
        {bus.stops && bus.stops.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span>Haltes op deze route</span>
            </h3>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {bus.stops.map((stop, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                    stop.passed
                      ? 'bg-slate-950/30 border-slate-800/40 text-slate-500'
                      : idx === 1
                      ? 'bg-sky-500/10 border-sky-500/40 text-sky-200 font-medium'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        stop.passed
                          ? 'bg-slate-800 text-slate-500'
                          : idx === 1
                          ? 'bg-sky-500 text-white animate-pulse'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span>{stop.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] tabular-nums text-slate-400">
                      {stop.time}
                    </span>
                    {stop.passed && <CheckCircle2 className="w-3 h-3 text-slate-600" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleFollow}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isFollowing
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20'
          }`}
        >
          <Navigation className={`w-4 h-4 ${isFollowing ? 'animate-spin' : ''}`} />
          <span>{isFollowing ? 'Volgen stoppen' : 'Volg bus op kaart'}</span>
        </button>

        <a
          href={
            bus.permalink ||
            `https://ovzoeker.nl/voertuig/${bus.ovzoekerId || `${bus.operator}:${bus.matnummer}`}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Open dit voertuig op ovzoeker.nl"
        >
          <ExternalLink className="w-4 h-4" />
        </a>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          Sluiten
        </button>
      </div>
    </aside>
  );
};
