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
    <aside className="fixed inset-x-0 bottom-0 top-14 md:static md:w-[380px] lg:w-[410px] h-[calc(100vh-3.5rem)] md:h-full z-[600] bg-[var(--bg-card)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col justify-between text-[var(--text-main)] shrink-0 animate-in slide-in-from-right duration-200 tabular-nums">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-3 bg-[var(--bg-elevated)]">
        <div className="flex items-start gap-3 min-w-0">
          <img
            src={`/${markerPng}`}
            alt={markerPng}
            className="w-10 h-10 rounded-[5px] object-contain shrink-0 border border-[var(--border-subtle)] bg-[var(--bg-main)] p-1"
          />
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-1.5 mb-1">
              <span className="px-2 py-0.5 rounded-[4px] text-xs font-bold font-mono bg-[var(--accent-gold)] text-[#060e0a]">
                {bus.operatorName} {bus.line}
              </span>
              <span className="text-xs font-mono font-bold text-[var(--accent-gold-bright)] tabular-nums">
                Bus {bus.matnummer}
              </span>
              {bus.ritnummer && (
                <span className="text-xs font-mono text-[var(--text-muted)] tabular-nums">
                  · Rit {bus.ritnummer}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-[var(--text-main)] tracking-tight leading-snug truncate">
              → {bus.destination}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
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
          className="px-2.5 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--status-crimson)] text-[var(--text-main)] border border-[var(--border-subtle)] transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold shrink-0"
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
          <div className="p-3 rounded-[5px] bg-[var(--bg-main)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] mb-1">
              <Gauge className="w-3.5 h-3.5 text-[var(--status-blue)]" />
              <span>Snelheid</span>
            </div>
            <div className="text-base font-bold font-mono text-[var(--text-main)] tabular-nums">
              {bus.speedKmH} <span className="text-xs font-normal text-[var(--text-muted)]">km/u</span>
            </div>
          </div>

          {/* Heading */}
          <div className="p-3 rounded-[5px] bg-[var(--bg-main)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] mb-1">
              <Compass className="w-3.5 h-3.5 text-[var(--status-purple)]" />
              <span>Richting</span>
            </div>
            <div className="text-base font-bold font-mono text-[var(--text-main)] tabular-nums">
              {bus.heading}°{' '}
              <span className="text-xs font-normal text-[var(--text-muted)]">
                {getCompassDirection(bus.heading)}
              </span>
            </div>
          </div>

          {/* Delay */}
          <div className="p-3 rounded-[5px] bg-[var(--bg-main)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] mb-1">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>Punctualiteit</span>
            </div>
            <div
              className={`text-sm font-bold font-mono tabular-nums ${
                isDelayed
                  ? 'text-[var(--status-crimson)]'
                  : isEarly
                  ? 'text-[var(--status-blue)]'
                  : 'text-[var(--status-emerald)]'
              }`}
            >
              {formatPunctualityText()}
            </div>
          </div>
        </div>

        {/* OVzoeker / Bus Specification Card */}
        <div className="p-4 rounded-[5px] bg-[var(--bg-main)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] pb-2 border-b border-[var(--border-subtle)]">
            <span className="font-semibold text-[var(--text-main)]">
              Live Voertuiggegevens (OVzoeker / GTFS-RT)
            </span>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span className="text-[var(--accent-gold-bright)] font-medium">{bus.busType}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Voertuignummer:</span>
            <span className="font-mono font-bold text-[var(--text-main)] tabular-nums">
              Bus {bus.matnummer} ({bus.ovzoekerId || `${bus.operator}:${bus.matnummer}`})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Kaartmarker:</span>
            <span className="font-mono text-[var(--text-main)] flex items-center gap-1.5">
              <img src={`/${markerPng}`} alt={markerPng} className="w-4 h-4 object-contain" />
              {markerPng}
            </span>
          </div>

          {bus.ritnummer && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Ritnummer:</span>
              <span className="font-mono text-[var(--text-main)] font-semibold tabular-nums">Rit {bus.ritnummer}</span>
            </div>
          )}

          {bus.omloopnummer && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Omloopnummer:</span>
              <span className="font-mono text-[var(--text-main)] font-semibold tabular-nums">{bus.omloopnummer}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Status:</span>
            <span className="font-medium text-[var(--text-main)] flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-[2px] ${
                  bus.status === 'Rijdend' ? 'bg-[var(--status-emerald)]' : 'bg-[var(--accent-gold)]'
                }`}
              />
              {bus.status}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Live GPS-coördinaten:</span>
            <span className="font-mono text-[var(--status-blue)] tabular-nums">
              {bus.lat.toFixed(5)}, {bus.lng.toFixed(5)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[var(--text-muted)]">Laatste GPS-update:</span>
            <span className="font-mono text-[var(--text-dim)] tabular-nums">{bus.lastUpdated}</span>
          </div>
        </div>

        {/* Route Stops / Dienstregeling */}
        {bus.stops && bus.stops.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>Haltes op deze route</span>
            </h3>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {bus.stops.map((stop, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-[4px] border text-xs flex items-center justify-between transition-colors tabular-nums ${
                    stop.passed
                      ? 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-dim)]'
                      : idx === 1
                      ? 'bg-[var(--bg-elevated)] border-[var(--border-focus)] text-[var(--text-main)] font-medium'
                      : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-[3px] flex items-center justify-center text-[9px] font-bold font-mono tabular-nums ${
                        stop.passed
                          ? 'bg-[var(--bg-card)] text-[var(--text-dim)]'
                          : idx === 1
                          ? 'bg-[var(--accent-gold)] text-[#060e0a]'
                          : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span>{stop.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                      {stop.time}
                    </span>
                    {stop.passed && <CheckCircle2 className="w-3 h-3 text-[var(--text-dim)]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-main)] flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleFollow}
          className={`flex-1 py-2.5 px-3 rounded-[4px] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isFollowing
              ? 'bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a]'
              : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-focus)]'
          }`}
        >
          <Navigation className={`w-4 h-4 ${isFollowing ? 'animate-spin' : 'text-[var(--accent-gold)]'}`} />
          <span>{isFollowing ? 'Volgen stoppen' : 'Volg bus op kaart'}</span>
        </button>

        <a
          href={
            bus.permalink ||
            `https://ovzoeker.nl/voertuig/${bus.ovzoekerId || `${bus.operator}:${bus.matnummer}`}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-colors"
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
          className="py-2.5 px-3 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] text-xs font-semibold transition-colors cursor-pointer"
        >
          Sluiten
        </button>
      </div>
    </aside>
  );
};
