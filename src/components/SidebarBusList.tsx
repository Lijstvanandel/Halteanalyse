import React, { useState } from 'react';
import { BusPosition } from '../types/bus';
import {
  X,
  Bus,
  Zap,
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
  const [selectedOperator] = useState<string>('ALL');
  const [filterElectricOnly, setFilterElectricOnly] = useState<boolean>(false);
  const [filterDelayedOnly, setFilterDelayedOnly] = useState<boolean>(false);

  if (!isOpen) return null;

  // Extract unique lines
  const uniqueLines = Array.from(new Set(buses.map((b) => b.line))).sort();

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
    <div className="fixed inset-y-0 left-0 z-[500] w-full max-w-md bg-[var(--bg-card)] border-r border-[var(--border-subtle)] shadow-2xl flex flex-col justify-between text-[var(--text-main)] animate-in slide-in-from-left duration-300 tabular-nums">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[4px] bg-[var(--bg-main)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-gold)]">
            <Bus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)] tracking-tight">
              Actieve Vloot Steenwijkerland
            </h2>
            <p className="text-xs text-[var(--text-muted)] tabular-nums">
              {buses.length} bussen binnen de gemeentegrenzen
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Fleet KPI Bar */}
      <div className="px-4 py-3 bg-[var(--bg-main)] border-b border-[var(--border-subtle)] grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-[4px] bg-[var(--bg-card)] border border-[var(--border-subtle)]">
          <div className="text-[11px] text-[var(--text-muted)]">Op tijd</div>
          <div className="text-sm font-bold font-mono text-[var(--status-emerald)] tabular-nums">
            {onTimePercentage}%
          </div>
        </div>
        <div className="p-2 rounded-[4px] bg-[var(--bg-card)] border border-[var(--border-subtle)]">
          <div className="text-[11px] text-[var(--text-muted)]">Elektrisch</div>
          <div className="text-sm font-bold font-mono text-[var(--accent-gold-bright)] tabular-nums">
            {electricPercentage}%
          </div>
        </div>
        <div className="p-2 rounded-[4px] bg-[var(--bg-card)] border border-[var(--border-subtle)]">
          <div className="text-[11px] text-[var(--text-muted)]">Gem. Snelheid</div>
          <div className="text-sm font-bold font-mono text-[var(--status-blue)] tabular-nums">
            {avgSpeed} km/u
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] space-y-2.5 bg-[var(--bg-card)]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Lijn:
          </span>
          <button
            onClick={() => setSelectedLine('ALL')}
            className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-colors cursor-pointer border tabular-nums ${
              selectedLine === 'ALL'
                ? 'bg-[var(--accent-gold)] text-[#060e0a] border-[var(--accent-gold-bright)]'
                : 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            Alle ({buses.length})
          </button>
          {uniqueLines.map((line) => (
            <button
              key={line}
              onClick={() => setSelectedLine(line)}
              className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold font-mono transition-colors cursor-pointer border tabular-nums ${
                selectedLine === line
                  ? 'bg-[var(--accent-gold)] text-[#060e0a] border-[var(--accent-gold-bright)]'
                  : 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              Lijn {line}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1 text-xs">
          <label className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
            <input
              type="checkbox"
              checked={filterElectricOnly}
              onChange={(e) => setFilterElectricOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded-[3px] bg-[var(--bg-main)] border-[var(--border-subtle)]"
            />
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[var(--accent-gold)]" /> Alleen Elektrisch
            </span>
          </label>

          <div className="w-[1px] h-3.5 bg-[var(--border-subtle)]" />

          <label className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
            <input
              type="checkbox"
              checked={filterDelayedOnly}
              onChange={(e) => setFilterDelayedOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded-[3px] bg-[var(--bg-main)] border-[var(--border-subtle)]"
            />
            <span>Alleen vertraagd (&gt;2m)</span>
          </label>
        </div>
      </div>

      {/* Buses List */}
      <div className="p-4 overflow-y-auto space-y-2 flex-1 bg-[var(--bg-main)]">
        {filteredBuses.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-dim)] text-xs">
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
                className={`p-3 rounded-[5px] border transition-all cursor-pointer tabular-nums ${
                  isSelected
                    ? 'bg-[var(--bg-elevated)] border-[var(--border-focus)]'
                    : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-[4px] text-xs font-bold font-mono bg-[var(--bg-elevated)] border border-[var(--border-focus)] text-[var(--accent-gold-bright)] tabular-nums">
                      Lijn {bus.line}
                    </span>
                    <span className="font-semibold text-xs text-[var(--text-main)]">
                      {bus.destination}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                    #{bus.matnummer}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[var(--text-muted)] text-[11px] pt-1.5 border-t border-[var(--border-subtle)]">
                  <span className="truncate max-w-[150px]">{bus.operatorName}</span>

                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="flex items-center gap-1 text-[var(--status-blue)]">
                      <Gauge className="w-3 h-3" />
                      {bus.speedKmH} km/u
                    </span>

                    <span
                      className={`font-semibold ${
                        isDelayed ? 'text-[var(--status-crimson)]' : 'text-[var(--status-emerald)]'
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
      <div className="p-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] text-[11px] text-[var(--text-dim)] flex items-center justify-between tabular-nums">
        <span>Kaartcoördinaten volgens NDOV / busposities.nl</span>
        <span className="font-mono text-[var(--text-muted)] tabular-nums">{buses.length} actieve eenheden</span>
      </div>
    </div>
  );
};
