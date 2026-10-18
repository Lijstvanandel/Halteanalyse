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
} from 'lucide-react';

interface TopNavbarProps {
  buses: BusPosition[];
  onSelectBus: (bus: BusPosition) => void;
  showDepartureBoard: boolean;
  onToggleDepartureBoard: () => void;
  onOpenFleetDrawer: () => void;
  onOpenPunctualityModal: () => void;
  loggedCount?: number;
  dataSource: string;
  isSyncing: boolean;
  onManualRefresh: () => void;
  feedMode: 'live' | 'demo';
  onToggleFeedMode: (mode: 'live' | 'demo') => void;
  statusMessage?: string;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  buses,
  onSelectBus,
  showDepartureBoard,
  onToggleDepartureBoard,
  onOpenFleetDrawer,
  onOpenPunctualityModal,
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
    <header className="h-14 bg-[#0E518D] border-b border-[#0A3D6B] px-4 md:px-6 flex items-center justify-between gap-4 z-30 select-none shrink-0 shadow-md">
      {/* Zone 1: Brand title */}
      <div className="flex items-center gap-3 shrink-0">
        <a href="/" className="flex items-center gap-2.5 text-white transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-[#FFCC00] flex items-center justify-center shadow-md">
            <span className="text-sm font-black text-[#0E518D]">DR</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
              DRGL.nl
            </span>
            <span className="text-xs text-[#FFCC00] font-semibold hidden sm:inline">
              Steenwijkerland
            </span>
          </div>
        </a>
      </div>

      {/* Zone 2: Navigation Controls & Real-Time Filter */}
      <div className="hidden lg:flex items-center gap-4">
        <nav className="flex items-center gap-2.5 text-xs font-medium text-white/90">
          {/* Departures Board Toggle */}
          <button
            onClick={onToggleDepartureBoard}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold ${
              showDepartureBoard
                ? 'bg-white text-[#0E518D] shadow-sm'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Vertrektijden Bord</span>
          </button>

          {/* Punctuality & Delay Logger Modal Button */}
          <button
            onClick={onOpenPunctualityModal}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-bold"
            title="Bekijk uitval, vertragingen en te vroege passages per halte en per lijn (Maand / Week) + CSV export"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#FFCC00]" />
            <span>Vertraging & Statistieken (.CSV)</span>
            {loggedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white font-mono text-[10px]">
                {loggedCount}
              </span>
            )}
          </button>

          {/* Strict Live vs Demo Mode Toggle */}
          <button
            onClick={() => onToggleFeedMode(feedMode === 'live' ? 'demo' : 'live')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${
              feedMode === 'live'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                : 'bg-amber-400/20 text-[#FFCC00] border border-[#FFCC00]/40'
            }`}
            title="Wissel tussen uitsluitend echt rijdende bussen en dienstregeling-voorbeeld"
          >
            {feedMode === 'live' ? (
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <ToggleRight className="w-3.5 h-3.5 text-[#FFCC00]" />
            )}
            <span>{feedMode === 'live' ? 'Modus: Echt Live' : 'Modus: Dienstregeling Preview'}</span>
          </button>

          {/* Fleet count */}
          <button
            onClick={onOpenFleetDrawer}
            className="px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer hover:bg-white/10"
          >
            <Bus className="w-3.5 h-3.5 text-[#FFCC00]" />
            <span>Vloot ({buses.length})</span>
          </button>
        </nav>

        {/* Search */}
        <div className="relative">
          <div className="flex items-center bg-[#0A3D6B] border border-blue-400/30 rounded-lg px-2.5 py-1.5 w-48 focus-within:border-[#FFCC00] focus-within:ring-1 focus-within:ring-[#FFCC00] transition-all">
            <Search className="w-3.5 h-3.5 text-blue-300 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Zoek rit of lijn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              className="bg-transparent text-xs text-white placeholder:text-blue-200/60 focus:outline-none w-full"
            />
          </div>

          {isSearchOpen && filteredBuses.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-300 rounded-xl shadow-2xl py-1 z-50 max-h-60 overflow-y-auto text-slate-800">
              {filteredBuses.map((bus) => (
                <button
                  key={bus.id}
                  onClick={() => {
                    onSelectBus(bus);
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0E518D] font-mono">Lijn {bus.line}</span>
                    <span className="text-slate-700">→ {bus.destination}</span>
                  </div>
                  <span className="font-mono text-slate-500 text-[11px]">#{bus.matnummer}</span>
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
          className="lg:hidden px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
          title="Vertraging & Statistieken (.CSV)"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#FFCC00]" />
          <span>Statistieken</span>
        </button>

        <button
          onClick={onManualRefresh}
          disabled={isSyncing}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          title="Ververs DRGL gegevens nu"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#FFCC00]' : ''}`} />
        </button>

        <button
          onClick={onToggleDepartureBoard}
          className="lg:hidden px-3 py-1.5 text-xs font-semibold text-[#0E518D] bg-[#FFCC00] hover:bg-amber-300 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Tijden</span>
        </button>

        <button
          onClick={onOpenFleetDrawer}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-[#FFCC00] hover:bg-amber-300 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Vloot</span>
          <span>({buses.length})</span>
        </button>
      </div>
    </header>
  );
};
