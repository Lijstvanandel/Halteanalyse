import React from 'react';
import { DRGLDeparture } from '../utils/drgl';
import {
  MapPin,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Map as MapIcon,
  X,
} from 'lucide-react';

interface DRGLDepartureBoardProps {
  title: string;
  departures: DRGLDeparture[];
  selectedStopCode: string;
  onSelectStopCode: (stopCode: string) => void;
  onSelectDeparture: (departure: DRGLDeparture) => void;
  isLoading: boolean;
  onRefresh: () => void;
  selectedJourneyUrl?: string | null;
  onClose?: () => void;
}

export const DRGL_KEY_STOPS = [
  { code: 'NL:S:16301010', name: 'Steenwijk — Busstation Station (Stationsplein)' },
  { code: 'NL:S:24550220', name: 'Steenwijk — Westercluft (Lijn 26)' },
  { code: 'NL:S:24550360', name: 'Steenwijk — Kallenkoterallee (Lijn 26)' },
  { code: 'NL:S:24550122', name: 'Steenwijk — Bedelaarspad (Lijn 26 & 524)' },
  { code: 'NL:S:16300010', name: 'Steenwijk — Gemeentehuis' },
  { code: 'NL:S:25780010', name: 'Giethoorn — Dominee T.O. Hylkemaweg' },
  { code: 'NL:S:25780050', name: 'Giethoorn — Hotel Harmonie' },
  { code: 'NL:S:25180010', name: 'Blokzijl — Busstation Blokzijl' },
  { code: 'NL:S:25270010', name: 'Vollenhove — Clarenberglaan' },
  { code: 'NL:S:46520010', name: 'Sint Jansklooster — Flevoweg' },
  { code: 'NL:S:24510040', name: 'Oldemarkt — Koningin Julianaweg' },
  { code: 'NL:S:25450810', name: 'Ossenzijl — Kooystraat / Brug' },
  { code: 'NL:S:24590100', name: 'Kuinre — Burchtstraat' },
  { code: 'NL:S:25680030', name: 'Wanneperveen — Blauwe Hand' },
  { code: 'NL:S:24550030', name: 'Zuidveen — Zuidveenseweg (Zuidveen)' },
  { code: 'NL:S:25380010', name: 'Scheerwolde — Jan van Nassauweg' },
  { code: 'NL:S:25280070', name: 'Wetering — Steenwijkerweg N333' },
  { code: 'NL:S:24670400', name: 'Eesveen — Hooilanden' },
  { code: 'NL:S:24552310', name: 'Tuk — Gemeentewerken' },
  { code: 'NL:S:24451800', name: 'Willemsoord — Steenwijkerweg' },
];

export const DRGLDepartureBoard: React.FC<DRGLDepartureBoardProps> = ({
  title,
  departures,
  selectedStopCode,
  onSelectStopCode,
  onSelectDeparture,
  isLoading,
  onRefresh,
  selectedJourneyUrl,
  onClose,
}) => {
  return (
    <div className="bg-[var(--bg-card)] rounded-[5px] border border-[var(--border-subtle)] overflow-hidden flex flex-col h-full text-[var(--text-main)] tabular-nums">
      {/* DRGL Panel Header */}
      <div className="bg-[var(--bg-elevated)] text-[var(--text-main)] p-2.5 flex items-center justify-between gap-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-[2px] bg-[var(--accent-gold)] shrink-0" />
          <h3 className="font-bold text-xs tracking-tight truncate">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-transparent hover:border-[var(--border-subtle)] transition-colors shrink-0 cursor-pointer"
            title="Ververs vertrektijden"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[var(--accent-gold)]' : ''}`} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-1 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Sluit vertrektijden en bekijk de kaart"
            >
              <MapIcon className="w-3 h-3" />
              <span>Naar Kaart</span>
              <X className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stop Area Selector Dropdown (Plaats — Haltenaam) */}
      <div className="p-2.5 bg-[var(--bg-main)] border-b border-[var(--border-subtle)] flex items-center gap-2">
        <MapPin className="w-4 h-4 text-[var(--accent-gold)] shrink-0" />
        <select
          value={selectedStopCode}
          onChange={(e) => onSelectStopCode(e.target.value)}
          className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--border-focus)]"
        >
          {DRGL_KEY_STOPS.map((stop) => (
            <option key={stop.code} value={stop.code} className="bg-[#0b1a13] text-[#f5f6f4]">
              {stop.name}
            </option>
          ))}
        </select>
      </div>

      {/* Departures List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
        {isLoading && departures.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            Vertrektijden ophalen van DRGL.nl...
          </div>
        ) : departures.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            Geen geplande vertrekken gevonden voor deze halte.
          </div>
        ) : (
          departures.map((dep, idx) => {
            const isSelected = selectedJourneyUrl === dep.journeyUrl;

            return (
              <div
                key={idx}
                onClick={() => onSelectDeparture(dep)}
                className={`p-3 transition-colors cursor-pointer text-xs ${
                  isSelected
                    ? 'bg-[var(--bg-elevated)] ring-1 ring-inset ring-[var(--border-focus)]'
                    : 'hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Departure time & platform */}
                  <div className="w-20 shrink-0 tabular-nums">
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        dep.isDelayed
                          ? 'text-[var(--status-crimson)]'
                          : dep.isUnknown
                          ? 'text-[var(--accent-gold)]'
                          : 'text-[var(--text-main)]'
                      }`}
                    >
                      {dep.time}
                    </div>
                    {dep.platform && (
                      <div className="text-[10px] font-medium text-[var(--text-dim)] tabular-nums">
                        {dep.platform}
                      </div>
                    )}
                  </div>

                  {/* Line Number Identifier */}
                  <div className="w-11 h-7 rounded-[4px] bg-[var(--bg-elevated)] border border-[var(--border-focus)] flex items-center justify-center font-bold font-mono text-xs text-[var(--accent-gold-bright)] shrink-0 tabular-nums">
                    {dep.lineCode}
                  </div>

                  {/* Destination & Product Category */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[var(--text-main)] truncate text-[13px]">
                      {dep.destination}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 truncate">
                      <span>{dep.category} · {dep.operator}</span>
                      {dep.crowdLevel === 0 && (
                        <span className="text-[10px] text-[var(--status-emerald)] font-medium">· rustig</span>
                      )}
                      {dep.crowdLevel === 1 && (
                        <span className="text-[10px] text-[var(--status-blue)] font-medium">· zitplaatsen</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-[var(--text-dim)] shrink-0" />
                </div>

                {/* Notices */}
                {dep.notices && dep.notices.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {dep.notices.map((n, nIdx) => (
                      <div
                        key={nIdx}
                        className="text-[11px] px-2 py-1 rounded-[4px] bg-[var(--accent-gold-glow)] text-[var(--accent-gold-bright)] border border-[var(--border-subtle)] flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3 h-3 text-[var(--accent-gold)] shrink-0" />
                        <span className="truncate">{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Dataproduct Footer */}
      <div className="p-2.5 bg-[var(--bg-main)] border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-dim)] flex items-center justify-between select-none tabular-nums">
        <span className="font-semibold text-[var(--accent-gold)]">Dataproduct van Lijst van Andel</span>
        <span className="font-mono text-[var(--text-muted)] tabular-nums">{departures.length} ritten</span>
      </div>
    </div>
  );
};
