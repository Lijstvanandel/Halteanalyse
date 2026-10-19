import React from 'react';
import { DRGLJourneyData } from '../utils/drgl';
import {
  X,
  Bus,
  MapPin,
  CheckCircle2,
  ExternalLink,
  Navigation,
  Gauge,
  Layers,
} from 'lucide-react';

interface DRGLJourneyViewProps {
  journey: DRGLJourneyData | null;
  onClose: () => void;
  onCenterMap: () => void;
  isLoading: boolean;
}

export const DRGLJourneyView: React.FC<DRGLJourneyViewProps> = ({
  journey,
  onClose,
  onCenterMap,
  isLoading,
}) => {
  if (!journey && !isLoading) return null;

  return (
    <aside className="fixed inset-x-0 bottom-0 top-14 md:static md:w-[380px] lg:w-[410px] h-[calc(100vh-3.5rem)] md:h-full z-[600] bg-[var(--bg-card)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col justify-between text-[var(--text-main)] shrink-0 animate-in slide-in-from-right duration-200 tabular-nums">
      {/* Header */}
      <div className="bg-[var(--bg-elevated)] text-[var(--text-main)] p-4 flex items-start justify-between gap-3 border-b border-[var(--border-subtle)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-[4px] text-xs font-bold font-mono bg-[var(--accent-gold)] text-[#060e0a] tabular-nums">
              Lijn {journey?.lineCode || 'Rit'}
            </span>
            {journey?.ritNumber && (
              <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
                · Rit {journey.ritNumber}
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-[var(--text-main)] tracking-tight truncate">
            Richting {journey?.destination}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            DRGL Rit-overzicht met halte-volgorde en actuele positie
          </p>
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {isLoading ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            Ritgegevens laden van DRGL.nl...
          </div>
        ) : journey ? (
          <>
            {/* Vehicle Progress Panel */}
            <div className="p-3.5 rounded-[5px] bg-[var(--bg-main)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-[var(--text-muted)] font-semibold text-[11px]">
                <span className="flex items-center gap-1.5 text-[var(--accent-gold-bright)]">
                  <Bus className="w-4 h-4" /> Voertuig &amp; Realtime
                </span>
                {journey.currentPosition && (
                  <span className="flex items-center gap-1 font-mono text-[var(--status-emerald)] font-bold tabular-nums">
                    <Gauge className="w-3.5 h-3.5" />
                    {journey.currentPosition.speed} km/u
                  </span>
                )}
              </div>

              <div className="p-2.5 rounded-[4px] bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-medium">
                {journey.progressText || 'Rit staat gepland te vertrekken volgens dienstregeling.'}
              </div>

              {journey.polyLines && journey.polyLines.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)] pt-1 tabular-nums">
                  <Layers className="w-3.5 h-3.5 text-[var(--status-blue)]" />
                  <span>Trajectlijn ingeladen op kaart ({journey.polyLines.length} GPS punten)</span>
                </div>
              )}
            </div>

            {/* Stops Itinerary List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-[var(--text-muted)] uppercase tracking-wider text-[11px] flex items-center gap-1.5 tabular-nums">
                  <MapPin className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>Haltes op deze rit ({journey.stops.length})</span>
                </h3>
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {journey.stops.map((stop, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-[4px] border text-xs flex items-center justify-between transition-colors tabular-nums ${
                      stop.isCancelled
                        ? 'bg-[var(--bg-main)] border-[var(--status-crimson)] text-[var(--status-crimson)]'
                        : stop.isPassed
                        ? 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-dim)]'
                        : idx === 0
                        ? 'bg-[var(--bg-elevated)] border-[var(--border-focus)] text-[var(--text-main)] font-semibold'
                        : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-[3px] flex items-center justify-center text-[10px] font-bold font-mono shrink-0 tabular-nums ${
                          idx === 0
                            ? 'bg-[var(--accent-gold)] text-[#060e0a]'
                            : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)]'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="truncate">
                        <div className="truncate">{stop.name}</div>
                        {stop.town && (
                          <div className="text-[10px] text-[var(--text-dim)] font-normal">
                            {stop.town}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[var(--text-muted)] font-semibold tabular-nums">
                        {stop.time}
                      </span>
                      {stop.isCancelled && (
                        <span className="text-[10px] text-[var(--status-crimson)] font-bold">Vervallen</span>
                      )}
                      {stop.isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--text-dim)]" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-main)] flex items-center gap-2">
        <button
          type="button"
          onClick={onCenterMap}
          className="flex-1 py-2 px-3 rounded-[4px] text-xs font-bold bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Toon op Kaart</span>
        </button>

        {journey && (
          <a
            href={`https://drgl.nl/journey/${journey.journeyId}/${journey.date}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-colors"
            title="Bekijk op DRGL.nl"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="py-2 px-3 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] text-xs font-semibold transition-colors cursor-pointer"
        >
          Sluiten
        </button>
      </div>
    </aside>
  );
};
