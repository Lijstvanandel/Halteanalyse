import React from 'react';
import { DRGLJourneyData } from '../utils/drgl';
import {
  X,
  Bus,
  Clock,
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
    <div className="fixed inset-y-0 right-0 z-[500] w-full max-w-md bg-white border-l border-slate-300 shadow-2xl flex flex-col justify-between text-slate-900 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-[#0E518D] text-white p-4 flex items-start justify-between border-b border-[#0A3D6B]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-[#FFCC00] text-slate-950">
              Lijn {journey?.lineCode || 'Rit'}
            </span>
            {journey?.ritNumber && (
              <span className="text-xs text-blue-200">
                Rit {journey.ritNumber}
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Richting {journey?.destination}
          </h2>
          <p className="text-xs text-blue-200 mt-0.5">
            DRGL Rit-overzicht met halte-volgorde en actuele positie
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">
            Ritgegevens laden van DRGL.nl...
          </div>
        ) : journey ? (
          <>
            {/* Vehicle Progress Panel (DRGL style) */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px]">
                <span className="flex items-center gap-1.5 text-[#0E518D]">
                  <Bus className="w-4 h-4" /> Voertuig & Realtime
                </span>
                {journey.currentPosition && (
                  <span className="flex items-center gap-1 font-mono text-emerald-600 font-bold">
                    <Gauge className="w-3.5 h-3.5" />
                    {journey.currentPosition.speed} km/u
                  </span>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-medium">
                {journey.progressText || 'Rit staat gepland te vertrekken volgens dienstregeling.'}
              </div>

              {journey.polyLines && journey.polyLines.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                  <Layers className="w-3.5 h-3.5 text-[#0E518D]" />
                  <span>Trajectlijn ingeladen op kaart ({journey.polyLines.length} GPS punten)</span>
                </div>
              )}
            </div>

            {/* Stops Itinerary List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#0E518D]" />
                  <span>Haltes op deze rit ({journey.stops.length})</span>
                </h3>
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {journey.stops.map((stop, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                      stop.isCancelled
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : stop.isPassed
                        ? 'bg-slate-100 border-slate-200 text-slate-400'
                        : idx === 0
                        ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          idx === 0
                            ? 'bg-[#0E518D] text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="truncate">
                        <div className="truncate">{stop.name}</div>
                        {stop.town && (
                          <div className="text-[10px] text-slate-500 font-normal">
                            {stop.town}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-slate-600 font-semibold tabular-nums">
                        {stop.time}
                      </span>
                      {stop.isCancelled && (
                        <span className="text-[10px] text-red-600 font-bold">Vervallen</span>
                      )}
                      {stop.isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
        <button
          onClick={onCenterMap}
          className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-[#0E518D] hover:bg-[#0A3D6B] text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5 text-[#FFCC00]" />
          <span>Toon op Kaart</span>
        </button>

        {journey && (
          <a
            href={`https://drgl.nl/journey/${journey.journeyId}/${journey.date}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-white transition-colors"
            title="Bekijk op DRGL.nl"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
};
