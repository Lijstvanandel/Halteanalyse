import React, { useState } from 'react';
import { BusPosition, OperatorCode } from '../types/bus';
import {
  X,
  SlidersHorizontal,
  Bus,
  Zap,
  Clock,
  Compass,
  ArrowRight,
  Gauge,
  Filter,
} from 'lucide-react';

interface SidebarBusListProps {
  buses: BusPosition[];
  selectedBusId: string | null;
  onSelectBus: (bus: BusPosition) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SidebarBusList: React.FC<SidebarBusListProps> = ({
  buses,
  selectedBusId,
  onSelectBus,
  isOpen,
  onClose,
}) => {
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedOperator, setSelectedOperator] = useState<string>('ALL');
  const [filterElectricOnly, setFilterElectricOnly] = useState<boolean>(false);
  const [filterDelayedOnly, setFilterDelayedOnly] = useState<boolean>(false);

  if (!isOpen) return null;

  // Extract unique lines and operators
  const uniqueLines = Array.from(new Set(buses.map((b) => b.line))).sort();
  const uniqueOperators = Array.from(new Set(buses.map((b) => b.operator)));

  // Filter buses
  const filteredBuses = buses.filter((b) => {
    if (selectedLine !== 'ALL' && b.line !== selectedLine) return false;
    if (selectedOperator !== 'ALL' && b.operator !== selectedOperator) return false;
    if (filterElectricOnly && b.busType !== 'Elektrisch') return false;
    if (filterDelayedOnly && b.delayMinutes <= 2) return false;
    return true;
  });

  // Calculate fleet stats
  const onTimeCount = buses.filter((b) => b.delayMinutes <= 2).length;
  const onTimePercentage = buses.length > 0 ? Math.round((onTimeCount / buses.length) * 100) : 100;
  const electricCount = buses.filter((b) => b.busType === 'Elektrisch').length;
  const electricPercentage = buses.length > 0 ? Math.round((electricCount / buses.length) * 100) : 0;
  const avgSpeed = buses.length > 0 ? Math.round(buses.reduce((acc, b) => acc + b.speedKmH, 0) / buses.length) : 0;

  return (
    <div className="fixed inset-y-0 left-0 z-[500] w-full max-w-md bg-slate-900/98 backdrop-blur-xl border-r border-slate-800 shadow-2xl flex flex-col justify-between text-slate-100 animate-in slide-in-from-left duration-300">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600/30 border border-sky-500/40 flex items-center justify-center text-sky-400">
            <Bus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Actieve Vloot Steenwijkerland
            </h2>
            <p className="text-xs text-slate-400">
              {buses.length} bussen binnen de gemeentegrenzen
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Fleet KPI Bar */}
      <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="text-[11px] text-slate-400">Op tijd</div>
          <div className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
            {onTimePercentage}%
          </div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="text-[11px] text-slate-400">Elektrisch</div>
          <div className="text-sm font-bold font-mono text-amber-400 tabular-nums">
            {electricPercentage}%
          </div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="text-[11px] text-slate-400">Gem. Snelheid</div>
          <div className="text-sm font-bold font-mono text-sky-400 tabular-nums">
            {avgSpeed} km/u
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="px-5 py-3 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Lijn:
          </span>
          <button
            onClick={() => setSelectedLine('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              selectedLine === 'ALL' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Alle ({buses.length})
          </button>
          {uniqueLines.map((line) => (
            <button
              key={line}
              onClick={() => setSelectedLine(line)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold font-mono transition-colors ${
                selectedLine === line ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Lijn {line}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1 text-xs">
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filterElectricOnly}
              onChange={(e) => setFilterElectricOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-sky-600"
            />
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Alleen Elektrisch
            </span>
          </label>

          <div className="w-[1px] h-3.5 bg-slate-700" />

          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filterDelayedOnly}
              onChange={(e) => setFilterDelayedOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-sky-600"
            />
            <span>Alleen vertraagd (&gt;2m)</span>
          </label>
        </div>
      </div>

      {/* Buses List */}
      <div className="p-5 overflow-y-auto space-y-2 flex-1">
        {filteredBuses.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            Geen bussen gevonden met de huidige filters.
          </div>
        ) : (
          filteredBuses.map((bus) => {
            const isSelected = selectedBusId === bus.id;
            const isDelayed = bus.delayMinutes > 2;

            return (
              <div
                key={bus.id}
                onClick={() => onSelectBus(bus)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600/15 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                    : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-sky-600 text-white shadow-sm">
                      Lijn {bus.line}
                    </span>
                    <span className="font-semibold text-xs text-white">
                      {bus.destination}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    #{bus.matnummer}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/60">
                  <span className="truncate max-w-[150px]">{bus.operatorName}</span>

                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-slate-500" />
                      {bus.speedKmH} km/u
                    </span>

                    <span
                      className={`font-semibold ${
                        isDelayed ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {bus.delayMinutes > 0 ? `+${bus.delayMinutes}m` : 'Op tijd'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Kaartcoördinaten volgens NDOV / busposities.nl</span>
        <span className="font-mono">{buses.length} actieve eenheden</span>
      </div>
    </div>
  );
};
