import React, { useState } from 'react';
import { BusPosition } from '../types/bus';
import {
  Search,
  RefreshCw,
  Bus,
  SlidersHorizontal,
  Clock,
  Radio,
  ToggleRight,
  BarChart3,
  Bike,
  Code2,
} from 'lucide-react';

interface TopNavbarProps {
  buses: BusPosition[];
  onSelectBus: (bus: BusPosition) => void;
  showDepartureBoard: boolean;
  onToggleDepartureBoard: () => void;
  onOpenFleetDrawer: () => void;
  onOpenPunctualityModal: () => void;
  onOpenDeelfietsModal?: () => void;
  onOpenOvFietsModal?: () => void;
  onOpenEmbedModal?: () => void;
  deelfietsAvailableCount?: number;
  ovfietsAvailableCount?: number;
  loggedCount?: number;
  dataSource: string;
  isSyncing: boolean;
  onManualRefresh: () => void;
  feedMode: 'live' | 'demo';
  onToggleFeedMode: (mode: 'live' | 'demo') => void;
  statusMessage?: string;
  isEmbed?: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  buses,
  onSelectBus,
  showDepartureBoard,
  onToggleDepartureBoard,
  onOpenFleetDrawer,
  onOpenPunctualityModal,
  onOpenDeelfietsModal,
  onOpenOvFietsModal,
  onOpenEmbedModal,
  deelfietsAvailableCount = 0,
  ovfietsAvailableCount = 0,
  loggedCount = 0,
  isSyncing,
  onManualRefresh,
  feedMode,
  onToggleFeedMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const filteredBuses = searchQuery.trim()
    ? buses.filter(
        (b) =>
          b.matnummer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.line.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.operatorName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="h-14 bg-[var(--bg-card)] border-b border-[var(--border-subtle)] px-3 md:px-5 flex items-center justify-between gap-3 z-30 select-none shrink-0">
      {/* Zone 1: Brand title (Lijst van Andel Dataproduct) */}
      <div className="flex items-center gap-3 shrink-0">
        <a href="/" className="flex items-center gap-2.5 text-[var(--text-main)] transition-opacity group">
          <div className="w-8 h-8 rounded-[4px] bg-[var(--accent-gold)] border border-[var(--accent-gold-bright)] flex items-center justify-center shrink-0">
            <span className="text-xs font-extrabold text-[#060e0a] tracking-tight">LA</span>
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tracking-tight text-[var(--text-main)] whitespace-nowrap">
                Lijst van Andel
              </span>
              <span className="text-xs text-[var(--accent-gold)] font-semibold hidden sm:inline">
                Steenwijkerland
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] hidden md:inline">
              Dataproduct · Actuele Busposities &amp; Deelfietsen
            </span>
          </div>
        </a>
      </div>

      {/* Zone 2: Navigation Controls & Real-Time Filter */}
      <div className="hidden lg:flex items-center gap-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-main)]">
          {/* Departures Board Toggle */}
          <button
            onClick={onToggleDepartureBoard}
            className={`px-3 py-1.5 rounded-[4px] border transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold ${
              showDepartureBoard
                ? 'bg-[var(--bg-elevated)] text-[var(--accent-gold-bright)] border-[var(--border-focus)]'
                : 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-main)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            <span>Vertrektijden Bord</span>
          </button>

          {/* Punctuality & Delay Logger Modal Button */}
          <button
            onClick={onOpenPunctualityModal}
            className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold tabular-nums"
            title="Bekijk uitval, vertragingen en te vroege passages per halte en per lijn (Maand / Week) + CSV export"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[var(--status-emerald)]" />
            <span>OV Vertraging (.CSV)</span>
            {loggedCount > 0 && (
              <span className="text-[var(--text-muted)] font-mono text-[11px] tabular-nums">
                · {loggedCount}
              </span>
            )}
          </button>

          {/* Deelfiets Nederland Modal Button */}
          {onOpenDeelfietsModal && (
            <button
              onClick={onOpenDeelfietsModal}
              className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold tabular-nums"
              title="Bekijk beschikbare en gehuurde deelfietsen per dag, week en maand voor alle locaties in Steenwijkerland + CSV export"
            >
              <Bike className="w-3.5 h-3.5 text-[var(--status-blue)]" />
              <span>Deelfietsen (.CSV)</span>
              <span className="text-[var(--status-blue)] font-mono text-[11px] tabular-nums">
                · {deelfietsAvailableCount} vrij
              </span>
            </button>
          )}

          {/* NS OV-fiets Station Steenwijk Modal Button */}
          {onOpenOvFietsModal && (
            <button
              onClick={onOpenOvFietsModal}
              className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold tabular-nums"
              title="Bekijk de actuele en historische beschikbaarheid van NS OV-fietsen op Station Steenwijk (swk002) + CSV export"
            >
              <img
                src="/bicycle_parking_open.png"
                alt="OV-fiets"
                className="w-3.5 h-4 object-contain shrink-0"
              />
              <span>OV-fiets (.CSV)</span>
              <span className="text-[var(--accent-gold-bright)] font-mono text-[11px] tabular-nums">
                · {ovfietsAvailableCount} vrij
              </span>
            </button>
          )}

          {/* Strict Live vs Demo Mode Toggle */}
          <button
            onClick={() => onToggleFeedMode(feedMode === 'live' ? 'demo' : 'live')}
            className={`px-3 py-1.5 rounded-[4px] border transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${
              feedMode === 'live'
                ? 'bg-[var(--bg-main)] text-[var(--status-emerald)] border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]'
                : 'bg-[var(--accent-gold-glow)] text-[var(--accent-gold-bright)] border-[var(--accent-gold)]'
            }`}
            title="Wissel tussen uitsluitend echt rijdende bussen en dienstregeling-voorbeeld"
          >
            {feedMode === 'live' ? (
              <Radio className="w-3.5 h-3.5 text-[var(--status-emerald)]" />
            ) : (
              <ToggleRight className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            )}
            <span>{feedMode === 'live' ? 'Modus: Echt Live' : 'Modus: Dienstregeling Preview'}</span>
          </button>

          {/* Fleet count */}
          <button
            onClick={onOpenFleetDrawer}
            className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer tabular-nums"
          >
            <Bus className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            <span>Vloot ({buses.length})</span>
          </button>
        </nav>

        {/* Search */}
        <div className="relative">
          <div className="flex items-center bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[4px] px-2.5 py-1.5 w-48 focus-within:border-[var(--border-focus)] transition-colors">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Zoek rit of lijn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              className="bg-transparent text-xs text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none w-full"
            />
          </div>

          {isSearchOpen && filteredBuses.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[5px] shadow-2xl py-1 z-50 max-h-60 overflow-y-auto text-[var(--text-main)]">
              {filteredBuses.map((bus) => (
                <button
                  key={bus.id}
                  onClick={() => {
                    onSelectBus(bus);
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--bg-card-hover)] transition-colors flex items-center justify-between text-xs border-b border-[var(--border-subtle)] last:border-b-0 tabular-nums"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--accent-gold)] font-mono">Lijn {bus.line}</span>
                    <span className="text-[var(--text-main)]">→ {bus.destination}</span>
                  </div>
                  <span className="font-mono text-[var(--text-muted)] text-[11px] tabular-nums">#{bus.matnummer}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenPunctualityModal}
          className="lg:hidden px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] rounded-[4px] transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
          title="Vertraging & Statistieken (.CSV)"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
          <span>Statistieken</span>
        </button>

        <button
          onClick={onManualRefresh}
          disabled={isSyncing}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] rounded-[4px] transition-colors cursor-pointer"
          title="Ververs DRGL gegevens nu"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[var(--accent-gold)]' : ''}`} />
        </button>

        <button
          onClick={onToggleDepartureBoard}
          className="lg:hidden px-3 py-1.5 text-xs font-semibold text-[#060e0a] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] rounded-[4px] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Tijden</span>
        </button>

        {onOpenEmbedModal && (
          <button
            onClick={onOpenEmbedModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            title="Insluiten als interactief dataproduct in nieuwsberichten (HTML/Iframe)"
          >
            <Code2 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            <span>Insluiten (&lt;/&gt;)</span>
          </button>
        )}

        <button
          onClick={onOpenFleetDrawer}
          className="px-3.5 py-1.5 text-xs font-bold text-[#060e0a] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] rounded-[4px] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Vloot</span>
          <span>({buses.length})</span>
        </button>
      </div>
    </header>
  );
};
