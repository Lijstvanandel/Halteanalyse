import React, { useState } from 'react';
import { BusPosition } from '../types/bus';
import {
  Search,
  RefreshCw,
  Bus,
  Clock,
  Radio,
  ToggleRight,
  BarChart3,
  Bike,
  Code2,
  Map as MapIcon,
  ExternalLink,
  Train,
} from 'lucide-react';

interface TopNavbarProps {
  buses: BusPosition[];
  onSelectBus: (bus: BusPosition) => void;
  showDepartureBoard: boolean;
  onToggleDepartureBoard: () => void;
  onShowMapOnly?: () => void;
  onOpenFleetDrawer: () => void;
  onOpenPunctualityModal: () => void;
  onOpenDeelfietsModal?: () => void;
  onOpenOvFietsModal?: () => void;
  onOpenEmbedModal?: () => void;
  onOpenAansluitingenModal?: () => void;
  trainsCount?: number;
  transferSuccessRate?: number;
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
  onShowMapOnly,
  onOpenFleetDrawer,
  onOpenPunctualityModal,
  onOpenDeelfietsModal,
  onOpenOvFietsModal,
  onOpenEmbedModal,
  onOpenAansluitingenModal,
  trainsCount = 0,
  transferSuccessRate = 0,
  deelfietsAvailableCount = 0,
  ovfietsAvailableCount = 0,
  loggedCount = 0,
  isSyncing,
  onManualRefresh,
  feedMode,
  onToggleFeedMode,
  isEmbed = false,
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
    <header className="bg-[var(--bg-card)] border-b border-[var(--border-subtle)] z-30 select-none shrink-0 flex flex-col">
      {/* Top Row: Brand, Search & Global Actions */}
      <div className="h-11 px-2.5 md:px-4 flex items-center justify-between gap-2 border-b border-[var(--border-subtle)]/70">
        {/* Zone 1: Brand title (Lijst van Andel Dataproduct) */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <a
            href="/"
            target={isEmbed ? '_blank' : undefined}
            rel={isEmbed ? 'noopener noreferrer' : undefined}
            className="flex items-center gap-2 text-[var(--text-main)] transition-opacity group min-w-0"
          >
            <div className="w-7 h-7 rounded-[4px] bg-[var(--accent-gold)] border border-[var(--accent-gold-bright)] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-extrabold text-[#060e0a] tracking-tight">LA</span>
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs sm:text-sm font-bold tracking-tight text-[var(--text-main)] whitespace-nowrap">
                  Lijst van Andel
                </span>
                <span className="text-[11px] text-[var(--accent-gold)] font-semibold hidden xs:inline whitespace-nowrap">
                  Steenwijkerland
                </span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] hidden md:inline truncate">
                Dataproduct · Actuele Busposities, Vertrektijden &amp; Deelfietsen
              </span>
            </div>
          </a>
        </div>

        {/* Zone 2: Search & Global Utility Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Search Input (visible from sm upwards) */}
          <div className="relative hidden sm:block">
            <div className="flex items-center bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[4px] px-2 py-1 w-36 md:w-44 focus-within:border-[var(--border-focus)] transition-colors">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] mr-1.5 shrink-0" />
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
                      <span className="font-bold text-[var(--accent-gold)] font-mono">
                        Lijn {bus.line}
                      </span>
                      <span className="text-[var(--text-main)]">→ {bus.destination}</span>
                    </div>
                    <span className="font-mono text-[var(--text-muted)] text-[11px] tabular-nums">
                      #{bus.matnummer}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live vs Demo Mode Toggle */}
          <button
            onClick={() => onToggleFeedMode(feedMode === 'live' ? 'demo' : 'live')}
            className={`px-2.5 py-1 rounded-[4px] border transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold ${
              feedMode === 'live'
                ? 'bg-[var(--bg-main)] text-[var(--status-emerald)] border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]'
                : 'bg-[var(--accent-gold-glow)] text-[var(--accent-gold-bright)] border-[var(--accent-gold)]'
            }`}
            title="Wissel tussen uitsluitend echt rijdende bussen en dienstregeling-voorbeeld"
          >
            {feedMode === 'live' ? (
              <Radio className="w-3 h-3 text-[var(--status-emerald)]" />
            ) : (
              <ToggleRight className="w-3 h-3 text-[var(--accent-gold)]" />
            )}
            <span>{feedMode === 'live' ? 'Echt Live' : 'Preview'}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={onManualRefresh}
            disabled={isSyncing}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] rounded-[4px] transition-colors cursor-pointer"
            title="Ververs live gegevens nu"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[var(--accent-gold)]' : ''}`}
            />
          </button>

          {/* Embed Button */}
          {onOpenEmbedModal && !isEmbed && (
            <button
              onClick={onOpenEmbedModal}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
              title="Insluiten als interactief dataproduct in nieuwsberichten (HTML/Iframe)"
            >
              <Code2 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>Insluiten (&lt;/&gt;)</span>
            </button>
          )}

          {/* Open in New Tab button when inside an iframe */}
          {isEmbed && (
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-[4px] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--accent-gold-bright)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] text-[11px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
              title="Open volledig scherm in nieuw tabblad"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden xs:inline">Volledig scherm</span>
            </a>
          )}
        </div>
      </div>

      {/* Bottom Row: Always-Visible Navigation Strip for Web, Iframe & Mobile */}
      <nav
        aria-label="Hoofdnavigatie dataproduct"
        className="px-2.5 md:px-4 py-1.5 bg-[var(--bg-main)] flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-medium text-[var(--text-main)]"
      >
        {/* 1. Kaart Button (always brings map into view on mobile/iframe) */}
        <button
          onClick={() => {
            if (onShowMapOnly) {
              onShowMapOnly();
            } else if (showDepartureBoard) {
              onToggleDepartureBoard();
            }
          }}
          className={`px-2.5 py-1.5 rounded-[4px] border transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold shrink-0 ${
            !showDepartureBoard
              ? 'bg-[var(--bg-elevated)] text-[var(--accent-gold-bright)] border-[var(--border-focus)]'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-main)]'
          }`}
          title="Toon de interactieve kaart met bussen, haltes en deelfietsen"
        >
          <MapIcon className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
          <span>Kaart</span>
        </button>

        {/* 2. Vertrektijden Bord Toggle */}
        <button
          onClick={onToggleDepartureBoard}
          className={`px-2.5 py-1.5 rounded-[4px] border transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold shrink-0 ${
            showDepartureBoard
              ? 'bg-[var(--bg-elevated)] text-[var(--accent-gold-bright)] border-[var(--border-focus)]'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-main)]'
          }`}
          title="Open of sluit het actuele DRGL vertrektijdenbord per halte"
        >
          <Clock className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
          <span>Vertrektijden</span>
        </button>

        {/* 3. Bussen / Vloot Drawer Button */}
        <button
          onClick={onOpenFleetDrawer}
          className="px-2.5 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] border border-[var(--accent-gold-bright)] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-bold tabular-nums shrink-0"
          title="Bekijk alle actueel rijdende bussen in Gemeente Steenwijkerland"
        >
          <Bus className="w-3.5 h-3.5" />
          <span>Bussen ({buses.length})</span>
        </button>

        {/* 4. Deelfietsen Modal Button */}
        {onOpenDeelfietsModal && (
          <button
            onClick={onOpenDeelfietsModal}
            className="px-2.5 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold tabular-nums shrink-0"
            title="Bekijk beschikbare en gehuurde deelfietsen per dag, week en maand voor alle 17 locaties in Steenwijkerland + CSV export"
          >
            <Bike className="w-3.5 h-3.5 text-[var(--status-blue)]" />
            <span>Deelfietsen</span>
            <span className="text-[var(--status-blue)] font-mono text-[11px] tabular-nums">
              ({deelfietsAvailableCount} vrij)
            </span>
          </button>
        )}

        {/* 5. NS OV-fiets Station Steenwijk Modal Button */}
        {onOpenOvFietsModal && (
          <button
            onClick={onOpenOvFietsModal}
            className="px-2.5 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold tabular-nums shrink-0"
            title="Bekijk de actuele en historische beschikbaarheid van NS OV-fietsen op Station Steenwijk (swk002) + CSV export"
          >
            <img
              src="/bicycle_parking_open.png"
              alt="OV-fiets"
              className="w-3.5 h-4 object-contain shrink-0"
            />
            <span>OV-fiets</span>
            <span className="text-[var(--accent-gold-bright)] font-mono text-[11px] tabular-nums">
              ({ovfietsAvailableCount} vrij)
            </span>
          </button>
        )}

        {/* 6. Aansluitingen & Overstap Station Steenwijk */}
        {onOpenAansluitingenModal && (
          <button
            onClick={onOpenAansluitingenModal}
            className="px-2.5 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--status-blue)] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold tabular-nums shrink-0"
            title="Bekijk de overstap- en aansluitingsanalyse tussen bussen en treinen op station Steenwijk (per dag, week, maand, per lijn) + CSV export"
          >
            <Train className="w-3.5 h-3.5 text-[var(--status-blue)]" />
            <span>Aansluitingen</span>
            {transferSuccessRate > 0 && (
              <span className="text-[var(--status-blue)] font-mono text-[11px] tabular-nums font-bold">
                ({transferSuccessRate}% gehaald)
              </span>
            )}
          </button>
        )}

        {/* 7. OV Vertraging & Statistieken Modal Button */}
        <button
          onClick={onOpenPunctualityModal}
          className="px-2.5 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-semibold tabular-nums shrink-0"
          title="Bekijk uitval, vertragingen en te vroege passages per halte en per lijn (Maand / Week) + CSV export"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[var(--status-emerald)]" />
          <span>OV Statistieken (.CSV)</span>
          {loggedCount > 0 && (
            <span className="text-[var(--text-muted)] font-mono text-[11px] tabular-nums">
              · {loggedCount}
            </span>
          )}
        </button>
      </nav>
    </header>
  );
};
