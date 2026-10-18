import React from 'react';
import { BusPosition } from '../types/bus';
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
  AlertTriangle,
  Radio,
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

  const isDelayed = bus.delayMinutes > 2;
  const isEarly = bus.delayMinutes < 0;

  // Heading to compass text helper
  const getCompassDirection = (deg: number): string => {
    const directions = ['N', 'NNO', 'NO', 'ONO', 'O', 'OZO', 'ZO', 'ZZO', 'Z', 'ZZW', 'ZW', 'WZW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round((deg % 360) / 22.5) % 16;
    return directions[idx];
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[500] w-full max-w-md bg-slate-900/98 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col justify-between text-slate-100 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-sky-500 text-white shadow-sm">
              Lijn {bus.line}
            </span>
            <span className="text-xs font-medium text-slate-400">
              {bus.operatorName}
            </span>
            <span className="text-xs font-mono text-slate-500">
              #{bus.matnummer}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight leading-snug">
            {bus.destination}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Van: {bus.origin}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-5 overflow-y-auto space-y-5 flex-1">
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
              {bus.heading}° <span className="text-xs font-normal text-slate-400">{getCompassDirection(bus.heading)}</span>
            </div>
          </div>

          {/* Delay */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Punctualiteit</span>
            </div>
            <div
              className={`text-base font-bold font-mono tabular-nums ${
                isDelayed ? 'text-red-400' : isEarly ? 'text-emerald-400' : 'text-slate-200'
              }`}
            >
              {bus.delayMinutes > 0 ? `+${bus.delayMinutes} min` : bus.delayMinutes < 0 ? `${bus.delayMinutes} min` : 'Op tijd'}
            </div>
          </div>
        </div>

        {/* Bus Specification Card */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/60">
            <span className="font-semibold text-slate-300">Voertuiggegevens</span>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 font-medium">{bus.busType}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Model:</span>
            <span className="font-medium text-slate-200">{bus.model}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Kenteken:</span>
            <span className="font-mono text-slate-200 font-semibold">{bus.licensePlate}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status:</span>
            <span className="font-medium text-slate-200 flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${bus.status === 'Rijdend' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {bus.status}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Coördinaten:</span>
            <span className="font-mono text-slate-400 tabular-nums">
              {bus.lat.toFixed(5)}, {bus.lng.toFixed(5)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">Laatste update:</span>
            <span className="font-mono text-slate-400 tabular-nums">{bus.lastUpdated}</span>
          </div>
        </div>

        {/* Route Stops / Dienstregeling */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>Haltes op deze route</span>
          </h3>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {bus.stops?.map((stop, idx) => (
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
                  <span className="font-mono text-[11px] tabular-nums text-slate-400">{stop.time}</span>
                  {stop.passed && <CheckCircle2 className="w-3 h-3 text-slate-600" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-3">
        <button
          onClick={onToggleFollow}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isFollowing
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20'
          }`}
        >
          <Navigation className={`w-4 h-4 ${isFollowing ? 'animate-spin' : ''}`} />
          <span>{isFollowing ? 'Volgen uitschakelen' : 'Volg bus op kaart'}</span>
        </button>

        <a
          href={`https://busposities.nl/voertuig/${bus.operator}/${bus.matnummer}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Open op busposities.nl"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};
