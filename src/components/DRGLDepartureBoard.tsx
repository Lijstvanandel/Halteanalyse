import React from 'react';
import { DRGLDeparture } from '../utils/drgl';
import {
  MapPin,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
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

const LINE_BADGE_COLORS: Record<string, string> = {
  '26': '#dc3545',
  '18': '#e11d48',
  '20': '#d97706',
  '524': '#ea580c',
  '70': '#00965E',
  '71': '#059669',
  '171': '#10b981',
  '76': '#0d9488',
  '146': '#0284c7',
  '214': '#0086d6',
  '217': '#9333ea',
  '270': '#16a34a',
  '675': '#4f46e5',
  '679': '#7c3aed',
};

export const DRGLDepartureBoard: React.FC<DRGLDepartureBoardProps> = ({
  title,
  departures,
  selectedStopCode,
  onSelectStopCode,
  onSelectDeparture,
  isLoading,
  onRefresh,
  selectedJourneyUrl,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-xl overflow-hidden flex flex-col h-full text-slate-900">
      {/* DRGL Panel Header */}
      <div className="bg-[#0E518D] text-white p-3.5 flex items-center justify-between border-b border-[#0A3D6B]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFCC00] animate-pulse shrink-0" />
          <h3 className="font-bold text-sm tracking-tight truncate">
            {title}
          </h3>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Ververs vertrektijden"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stop Area Selector Dropdown (Plaats — Haltenaam) */}
      <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-[#0E518D] shrink-0" />
        <select
          value={selectedStopCode}
          onChange={(e) => onSelectStopCode(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0E518D]"
        >
          {DRGL_KEY_STOPS.map((stop) => (
            <option key={stop.code} value={stop.code}>
              {stop.name}
            </option>
          ))}
        </select>
      </div>

      {/* Departures List (Matching exact DRGL table) */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
        {isLoading && departures.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Vertrektijden ophalen van DRGL.nl...
          </div>
        ) : departures.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Geen geplande vertrekken gevonden voor deze halte.
          </div>
        ) : (
          departures.map((dep, idx) => {
            const isSelected = selectedJourneyUrl === dep.journeyUrl;

            const defaultColor = LINE_BADGE_COLORS[dep.lineCode];
            const bg =
              dep.lineStyle?.background && dep.lineStyle.background !== '#ffffff'
                ? dep.lineStyle.background
                : defaultColor || '#0E518D';
            const color = '#ffffff';
            const borderColor = bg;

            return (
              <div
                key={idx}
                onClick={() => onSelectDeparture(dep)}
                className={`p-3 transition-colors cursor-pointer text-xs ${
                  isSelected
                    ? 'bg-blue-50 border-l-4 border-l-[#0E518D]'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Departure time & platform */}
                  <div className="w-20 shrink-0">
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        dep.isDelayed
                          ? 'text-red-600'
                          : dep.isUnknown
                          ? 'text-amber-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {dep.time}
                    </div>
                    {dep.platform && (
                      <div className="text-[10px] font-semibold text-slate-500">
                        {dep.platform}
                      </div>
                    )}
                  </div>

                  {/* Line Number Badge */}
                  <div
                    className="w-10 h-7 rounded flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
                    style={{
                      backgroundColor: bg,
                      color: color,
                      border: `1.5px solid ${borderColor}`,
                    }}
                  >
                    {dep.lineCode}
                  </div>

                  {/* Destination & Product Category */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate text-[13px]">
                      {dep.destination}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                      <span>{dep.category} • {dep.operator}</span>
                      {dep.crowdLevel === 0 && (
                        <span className="text-[10px] text-emerald-600 font-medium">· leeg</span>
                      )}
                      {dep.crowdLevel === 1 && (
                        <span className="text-[10px] text-blue-600 font-medium">· zitplaatsen</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                {/* Notices */}
                {dep.notices && dep.notices.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {dep.notices.map((n, nIdx) => (
                      <div
                        key={nIdx}
                        className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
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
      <div className="p-2.5 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between select-none">
        <span className="font-bold text-[#0E518D]">Dataproduct van Lijst van Andel</span>
        <span className="font-mono text-slate-500">{departures.length} ritten</span>
      </div>
    </div>
  );
};
