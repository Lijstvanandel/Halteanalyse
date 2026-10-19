import React, { useMemo, useState, useEffect } from 'react';
import {
  DeelfietsLocation,
  DeelfietsLogEntry,
  aggregateDeelfietsStats,
  exportDeelfietsStatsToCSV,
  exportRawDeelfietsLogsToCSV,
} from '../utils/deelfiets';
import {
  OvFietsLocation,
  OvFietsLogEntry,
  aggregateOvFietsStats,
  exportOvFietsStatsToCSV,
  exportRawOvFietsLogsToCSV,
  OFFICIAL_STEENWIJK_OVFIETS,
} from '../utils/ovfiets';
import { getISOWeekInfo } from '../utils/punctuality';
import {
  X,
  Bike,
  Calendar,
  MapPin,
  RefreshCw,
  FileSpreadsheet,
  Search,
  Zap,
  TrendingUp,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface DeelfietsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  locations: DeelfietsLocation[];
  logs: DeelfietsLogEntry[];
  initialLocationFilter?: string;
  onTriggerLiveScan: () => void;
  isScanning: boolean;
  ovfietsLocation?: OvFietsLocation | null;
  ovfietsLogs?: OvFietsLogEntry[];
  onTriggerLiveOvFietsScan?: () => void;
  isScanningOvFiets?: boolean;
  initialNetworkTab?: 'deelfiets' | 'ovfiets';
}

export const DeelfietsDashboard: React.FC<DeelfietsDashboardProps> = ({
  isOpen,
  onClose,
  locations,
  logs,
  initialLocationFilter = '',
  onTriggerLiveScan,
  isScanning,
  ovfietsLocation,
  ovfietsLogs = [],
  onTriggerLiveOvFietsScan,
  isScanningOvFiets = false,
  initialNetworkTab = 'deelfiets',
}) => {
  const [networkTab, setNetworkTab] = useState<'deelfiets' | 'ovfiets'>(initialNetworkTab);

  useEffect(() => {
    if (initialNetworkTab) {
      setNetworkTab(initialNetworkTab);
    }
  }, [initialNetworkTab]);

  const nowInfo = useMemo(() => getISOWeekInfo(new Date()), []);

  // Shared Time Filter State
  const [periodMode, setPeriodMode] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDay, setSelectedDay] = useState<string>(nowInfo.dateStr);
  const [selectedWeek, setSelectedWeek] = useState<string>(nowInfo.yearWeek);
  const [selectedMonth, setSelectedMonth] = useState<string>(nowInfo.yearMonth);

  // Deelfiets specific filters
  const [selectedTown, setSelectedTown] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>(initialLocationFilter);

  useEffect(() => {
    if (initialLocationFilter !== undefined) {
      setSearchQuery(initialLocationFilter);
    }
  }, [initialLocationFilter]);

  // Available dates
  const availableDays = useMemo(() => {
    const s = new Set<string>([nowInfo.dateStr]);
    logs.forEach((l) => s.add(l.date));
    ovfietsLogs.forEach((l) => s.add(l.date));
    return Array.from(s).sort().reverse();
  }, [logs, ovfietsLogs, nowInfo.dateStr]);

  const availableWeeks = useMemo(() => {
    const s = new Set<string>([nowInfo.yearWeek]);
    logs.forEach((l) => s.add(l.yearWeek));
    ovfietsLogs.forEach((l) => s.add(l.yearWeek));
    return Array.from(s).sort().reverse();
  }, [logs, ovfietsLogs, nowInfo.yearWeek]);

  const availableMonths = useMemo(() => {
    const s = new Set<string>([nowInfo.yearMonth]);
    logs.forEach((l) => s.add(l.yearMonth));
    ovfietsLogs.forEach((l) => s.add(l.yearMonth));
    return Array.from(s).sort().reverse();
  }, [logs, ovfietsLogs, nowInfo.yearMonth]);

  const availableTowns = useMemo(() => {
    const s = new Set<string>();
    locations.forEach((loc) => s.add(loc.town));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'nl'));
  }, [locations]);

  // Deelfiets Nederland aggregate
  const statsList = useMemo(() => {
    const allStats = aggregateDeelfietsStats(
      locations,
      logs,
      selectedDay,
      selectedWeek,
      selectedMonth,
      periodMode
    );
    return allStats.filter((st) => {
      if (selectedTown !== 'ALL' && st.town !== selectedTown) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          st.locationName.toLowerCase().includes(q) ||
          st.town.toLowerCase().includes(q) ||
          st.streetAddress.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    locations,
    logs,
    selectedDay,
    selectedWeek,
    selectedMonth,
    periodMode,
    selectedTown,
    searchQuery,
  ]);

  const summary = useMemo(() => {
    const currentAvailable = statsList.reduce((a, b) => a + b.currentAvailable, 0);
    const currentRented = statsList.reduce((a, b) => a + b.currentRented, 0);
    const totalCapacity = statsList.reduce((a, b) => a + b.capacity, 0);

    const avgAvailDay = Number(
      statsList.reduce((a, b) => a + b.avgAvailableDay, 0).toFixed(1)
    );
    const avgAvailWeek = Number(
      statsList.reduce((a, b) => a + b.avgAvailableWeek, 0).toFixed(1)
    );
    const avgAvailMonth = Number(
      statsList.reduce((a, b) => a + b.avgAvailableMonth, 0).toFixed(1)
    );

    const avgRentedDay = Number(
      statsList.reduce((a, b) => a + b.avgRentedDay, 0).toFixed(1)
    );
    const avgRentedWeek = Number(
      statsList.reduce((a, b) => a + b.avgRentedWeek, 0).toFixed(1)
    );
    const avgRentedMonth = Number(
      statsList.reduce((a, b) => a + b.avgRentedMonth, 0).toFixed(1)
    );

    const totalRentedDay = statsList.reduce((a, b) => a + b.totalRentedDay, 0);
    const totalRentedWeek = statsList.reduce((a, b) => a + b.totalRentedWeek, 0);
    const totalRentedMonth = statsList.reduce((a, b) => a + b.totalRentedMonth, 0);

    return {
      currentAvailable,
      currentRented,
      totalCapacity,
      avgAvailDay,
      avgAvailWeek,
      avgAvailMonth,
      avgRentedDay,
      avgRentedWeek,
      avgRentedMonth,
      totalRentedDay,
      totalRentedWeek,
      totalRentedMonth,
    };
  }, [statsList]);

  // NS OV-fiets Station Steenwijk aggregate
  const activeOvFiets = ovfietsLocation || OFFICIAL_STEENWIJK_OVFIETS;
  const ovfietsStats = useMemo(() => {
    return aggregateOvFietsStats(
      activeOvFiets,
      ovfietsLogs,
      selectedDay,
      selectedWeek,
      selectedMonth
    );
  }, [activeOvFiets, ovfietsLogs, selectedDay, selectedWeek, selectedMonth]);

  if (!isOpen) return null;

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // CSV Handlers - Deelfiets Nederland
  const handleExportDeelfietsStatsCSV = () => {
    const periodTag =
      periodMode === 'day'
        ? selectedDay
        : periodMode === 'week'
        ? selectedWeek
        : selectedMonth;
    const csv = exportDeelfietsStatsToCSV(statsList);
    downloadCSV(csv, `steenwijkerland_deelfietsen_statistieken_${periodTag}.csv`);
  };

  const handleExportDeelfietsRawCSV = () => {
    const csv = exportRawDeelfietsLogsToCSV(logs);
    downloadCSV(csv, `steenwijkerland_deelfietsen_ruwe_metingen.csv`);
  };

  // CSV Handlers - NS OV-fiets Station Steenwijk
  const handleExportOvFietsStatsCSV = () => {
    const periodTag =
      periodMode === 'day'
        ? selectedDay
        : periodMode === 'week'
        ? selectedWeek
        : selectedMonth;
    const csv = exportOvFietsStatsToCSV(ovfietsStats);
    downloadCSV(csv, `station_steenwijk_ovfiets_statistieken_${periodTag}.csv`);
  };

  const handleExportOvFietsRawCSV = () => {
    const csv = exportRawOvFietsLogsToCSV(ovfietsLogs);
    downloadCSV(csv, `station_steenwijk_ovfiets_ruwe_metingen.csv`);
  };

  const ovPercentAvailable =
    activeOvFiets.totalCapacity > 0
      ? Math.round((activeOvFiets.available / activeOvFiets.totalCapacity) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-[1000] bg-[#060e0a]/85 backdrop-blur-xs flex items-center justify-center p-2 md:p-6 animate-in fade-in duration-200 tabular-nums">
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[6px] shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-[var(--text-main)]">
        {/* Top Header */}
        <div className="bg-[var(--bg-elevated)] text-[var(--text-main)] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[4px] bg-[var(--accent-gold)] text-[#060e0a] flex items-center justify-center font-bold">
              {networkTab === 'ovfiets' ? (
                <img
                  src="/bicycle_parking_open.png"
                  alt="OV-fiets"
                  className="w-6 h-6 object-contain"
                />
              ) : (
                <Bike className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold tracking-tight text-[var(--text-main)]">
                {networkTab === 'ovfiets'
                  ? 'NS OV-fiets — Station Steenwijk (Locatie: swk002)'
                  : 'Deelfiets Nederland — Steenwijkerland Verhuurmonitor'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {networkTab === 'ovfiets'
                  ? 'Officiële zelfservice stalling Stationsplein 2 · Los gemeten van gemeentelijke deelfietsen'
                  : `Live monitoring van alle ${locations.length} locaties van Deelfiets Nederland in Steenwijkerland`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Scan Button */}
            {networkTab === 'ovfiets' ? (
              <button
                type="button"
                onClick={onTriggerLiveOvFietsScan}
                disabled={isScanningOvFiets}
                className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Haal direct actuele voorraad op van ovfietsbeschikbaar.nl"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isScanningOvFiets ? 'animate-spin text-[var(--accent-gold)]' : ''}`}
                />
                <span>{isScanningOvFiets ? 'Scannen...' : 'Nu Live Scannen'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onTriggerLiveScan}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Haal direct actuele voorraad op van deelfietsnederland.nl"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[var(--accent-gold)]' : ''}`}
                />
                <span>{isScanning ? 'Scannen...' : 'Nu Live Scannen'}</span>
              </button>
            )}

            {/* CSV Export Buttons */}
            {networkTab === 'ovfiets' ? (
              <>
                <button
                  type="button"
                  onClick={handleExportOvFietsStatsCSV}
                  className="px-3.5 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export OV-fiets (.CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportOvFietsRawCSV}
                  className="hidden sm:flex px-3 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--status-emerald)]" />
                  <span>Alle Metingen (.CSV)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleExportDeelfietsStatsCSV}
                  className="px-3.5 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Deelfiets Tabel (.CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportDeelfietsRawCSV}
                  className="hidden sm:flex px-3 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--status-emerald)]" />
                  <span>Alle Metingen (.CSV)</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer ml-1"
              title="Sluiten"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Network Switcher Subheader (Explicit Separation) */}
        <div className="bg-[var(--bg-main)] border-b border-[var(--border-subtle)] px-5 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider mr-1 hidden sm:inline">
              Netwerk:
            </span>
            <div className="inline-flex rounded-[4px] bg-[var(--bg-card)] p-0.5 border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setNetworkTab('deelfiets')}
                className={`px-3.5 py-1.5 rounded-[3px] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums ${
                  networkTab === 'deelfiets'
                    ? 'bg-[var(--bg-elevated)] text-[var(--status-blue)] border border-[var(--border-focus)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <span>Deelfiets Nederland ({locations.length} hubs)</span>
                <span className="text-[11px] font-mono text-[var(--text-main)] tabular-nums">
                  · {summary.currentAvailable} vrij
                </span>
              </button>

              <button
                type="button"
                onClick={() => setNetworkTab('ovfiets')}
                className={`px-3.5 py-1.5 rounded-[3px] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums ${
                  networkTab === 'ovfiets'
                    ? 'bg-[var(--bg-elevated)] text-[var(--accent-gold-bright)] border border-[var(--border-focus)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <img
                  src="/bicycle_parking_open.png"
                  alt="OV-fiets"
                  className="w-3.5 h-3.5 object-contain"
                />
                <span>NS OV-fiets Station Steenwijk (swk002)</span>
                <span className="text-[11px] font-mono text-[var(--accent-gold-bright)] tabular-nums">
                  · {activeOvFiets.available} vrij
                </span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] hidden md:flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--status-emerald)]" />
            <span>
              {networkTab === 'ovfiets'
                ? 'Gegevens live gesynchroniseerd met ovfietsbeschikbaar.nl'
                : 'Gegevens live gesynchroniseerd met deelfietsnederland.nl'}
            </span>
          </div>
        </div>

        {/* Filter Bar (Day vs Week vs Month) */}
        <div className="bg-[var(--bg-card)] border-b border-[var(--border-subtle)] px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-[4px] bg-[var(--bg-main)] p-0.5 border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setPeriodMode('day')}
                className={`px-3 py-1.5 rounded-[3px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  periodMode === 'day'
                    ? 'bg-[var(--accent-gold)] text-[#060e0a]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Per Dag</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('week')}
                className={`px-3 py-1.5 rounded-[3px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  periodMode === 'week'
                    ? 'bg-[var(--accent-gold)] text-[#060e0a]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Per Week</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className={`px-3 py-1.5 rounded-[3px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  periodMode === 'month'
                    ? 'bg-[var(--accent-gold)] text-[#060e0a]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Per Maand</span>
              </button>
            </div>

            {periodMode === 'day' && (
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[4px] px-2.5 py-1.5 font-semibold text-[var(--text-main)] focus:outline-none tabular-nums"
              >
                {availableDays.map((d) => (
                  <option key={d} value={d} className="bg-[#0b1a13] text-[#f5f6f4]">
                    Dag: {d}
                  </option>
                ))}
              </select>
            )}

            {periodMode === 'week' && (
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[4px] px-2.5 py-1.5 font-semibold text-[var(--text-main)] focus:outline-none tabular-nums"
              >
                {availableWeeks.map((w) => (
                  <option key={w} value={w} className="bg-[#0b1a13] text-[#f5f6f4]">
                    ISO Week: {w}
                  </option>
                ))}
              </select>
            )}

            {periodMode === 'month' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[4px] px-2.5 py-1.5 font-semibold text-[var(--text-main)] focus:outline-none tabular-nums"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-[#0b1a13] text-[#f5f6f4]">
                    Maand: {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          {networkTab === 'deelfiets' && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedTown}
                onChange={(e) => setSelectedTown(e.target.value)}
                className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[4px] px-2.5 py-1.5 font-semibold text-[var(--text-main)] focus:outline-none tabular-nums"
              >
                <option value="ALL" className="bg-[#0b1a13] text-[#f5f6f4]">
                  Alle plaatsen in Steenwijkerland ({availableTowns.length})
                </option>
                {availableTowns.map((t) => (
                  <option key={t} value={t} className="bg-[#0b1a13] text-[#f5f6f4]">
                    {t}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--text-dim)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter locatie..."
                  className="bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[4px] pl-8 pr-6 py-1.5 text-xs text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-focus)] w-44"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          {networkTab === 'ovfiets' && (
            <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
              <span className="font-semibold text-[var(--accent-gold-bright)]">Zelfservice stalling</span>
              <span>· Stationsplein 2, 8331 GM Steenwijk</span>
            </div>
          )}
        </div>

        {/* TAB 1: DEELFIETS NEDERLAND CONTENT */}
        {networkTab === 'deelfiets' && (
          <>
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-3 bg-[var(--bg-main)] border-b border-[var(--border-subtle)] shrink-0 tabular-nums">
              <div className="bg-[var(--bg-card)] p-3 rounded-[4px] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                  <span className="font-semibold">Nu Live op Locaties</span>
                  <Bike className="w-4 h-4 text-[var(--status-blue)]" />
                </div>
                <div className="text-xl font-extrabold font-mono text-[var(--text-main)] tabular-nums">
                  {summary.currentAvailable}{' '}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    / {summary.totalCapacity} beschikbaar
                  </span>
                </div>
                <div className="text-[11px] text-[var(--status-emerald)] font-semibold mt-0.5 tabular-nums">
                  Nu actief verhuurd: {summary.currentRented} fietsen
                </div>
              </div>

              <div className="bg-[var(--bg-card)] p-3 rounded-[4px] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs text-[var(--status-blue)] mb-1">
                  <span className="font-semibold">Gem. Beschikbare Fietsen</span>
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-blue)]" />
                </div>
                <div className="text-xl font-extrabold font-mono text-[var(--status-blue)] tabular-nums">
                  {periodMode === 'day'
                    ? summary.avgAvailDay
                    : periodMode === 'week'
                    ? summary.avgAvailWeek
                    : summary.avgAvailMonth}{' '}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-dim)] mt-0.5 font-mono tabular-nums">
                  Dag: {summary.avgAvailDay} · Week: {summary.avgAvailWeek} · Maand:{' '}
                  {summary.avgAvailMonth}
                </div>
              </div>

              <div className="bg-[var(--bg-card)] p-3 rounded-[4px] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs text-[var(--accent-gold-bright)] mb-1">
                  <span className="font-semibold">Gem. Gehuurde Fietsen</span>
                  <Zap className="w-4 h-4 text-[var(--accent-gold)]" />
                </div>
                <div className="text-xl font-extrabold font-mono text-[var(--accent-gold-bright)] tabular-nums">
                  {periodMode === 'day'
                    ? summary.avgRentedDay
                    : periodMode === 'week'
                    ? summary.avgRentedWeek
                    : summary.avgRentedMonth}{' '}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-dim)] mt-0.5 font-mono tabular-nums">
                  Dag: {summary.avgRentedDay} · Week: {summary.avgRentedWeek} · Maand:{' '}
                  {summary.avgRentedMonth}
                </div>
              </div>

              <div className="bg-[var(--bg-card)] p-3 rounded-[4px] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs text-[var(--status-emerald)] mb-1">
                  <span className="font-semibold">Totaal Gehuurde Fietsen</span>
                  <TrendingUp className="w-4 h-4 text-[var(--status-emerald)]" />
                </div>
                <div className="text-xl font-extrabold font-mono text-[var(--status-emerald)] tabular-nums">
                  {periodMode === 'day'
                    ? summary.totalRentedDay
                    : periodMode === 'week'
                    ? summary.totalRentedWeek
                    : summary.totalRentedMonth}{' '}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    verhuringen ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-dim)] mt-0.5 font-mono tabular-nums">
                  Dag: {summary.totalRentedDay} · Week: {summary.totalRentedWeek} · Maand:{' '}
                  {summary.totalRentedMonth}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4 bg-[var(--bg-main)]">
              <div className="border border-[var(--border-subtle)] rounded-[5px] overflow-hidden bg-[var(--bg-card)]">
                <table className="w-full text-left border-collapse text-xs tabular-nums">
                  <thead>
                    <tr className="bg-[var(--bg-elevated)] text-[var(--text-muted)] border-b border-[var(--border-subtle)] uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 font-bold">Plaats &amp; Deelfietslocatie</th>
                      <th className="py-2.5 px-2.5 font-bold">Adres &amp; Type</th>
                      <th className="py-2.5 px-2.5 font-bold text-right">Nu Live (Beschikbaar / Cap.)</th>
                      <th className="py-2.5 px-2.5 font-bold text-right text-[var(--status-blue)]">
                        Gem. Beschikbaar
                        <div className="text-[9px] font-normal text-[var(--text-dim)]">Dag | Week | Maand</div>
                      </th>
                      <th className="py-2.5 px-2.5 font-bold text-right text-[var(--accent-gold-bright)]">
                        Gem. Gehuurd
                        <div className="text-[9px] font-normal text-[var(--text-dim)]">Dag | Week | Maand</div>
                      </th>
                      <th className="py-2.5 px-3 font-bold text-right text-[var(--status-emerald)]">
                        Totaal Gehuurd
                        <div className="text-[9px] font-normal text-[var(--text-dim)]">Dag | Week | Maand</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {statsList.map((st) => (
                      <tr key={st.stationId} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[var(--status-blue)] shrink-0" />
                            <span>
                              {st.town} — {st.locationName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-[var(--text-muted)]">
                          <div>{st.streetAddress}</div>
                          <span
                            className={`text-[10px] font-medium ${
                              st.isCargoBike
                                ? 'text-[var(--status-purple)]'
                                : 'text-[var(--status-blue)]'
                            }`}
                          >
                            {st.isCargoBike ? 'Elektrische Deelbakfiets' : 'Elektrische Deelfiets'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                          <span
                            className={`font-bold ${
                              st.currentAvailable > 0
                                ? 'text-[var(--status-emerald)]'
                                : 'text-[var(--status-crimson)]'
                            }`}
                          >
                            {st.currentAvailable} / {st.capacity}
                          </span>
                          <div className="text-[10px] text-[var(--text-dim)] mt-0.5 tabular-nums">
                            Nu verhuurd: {st.currentRented}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                          <div className="font-bold text-[var(--status-blue)] text-sm">
                            {periodMode === 'day'
                              ? st.avgAvailableDay
                              : periodMode === 'week'
                              ? st.avgAvailableWeek
                              : st.avgAvailableMonth}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            D: <strong className="text-[var(--text-muted)]">{st.avgAvailableDay}</strong> | W: <strong className="text-[var(--text-muted)]">{st.avgAvailableWeek}</strong> | M:{' '}
                            <strong className="text-[var(--text-muted)]">{st.avgAvailableMonth}</strong>
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                          <div className="font-bold text-[var(--accent-gold-bright)] text-sm">
                            {periodMode === 'day'
                              ? st.avgRentedDay
                              : periodMode === 'week'
                              ? st.avgRentedWeek
                              : st.avgRentedMonth}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            D: <strong className="text-[var(--text-muted)]">{st.avgRentedDay}</strong> | W: <strong className="text-[var(--text-muted)]">{st.avgRentedWeek}</strong> | M:{' '}
                            <strong className="text-[var(--text-muted)]">{st.avgRentedMonth}</strong>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <div className="font-bold text-[var(--status-emerald)] text-sm">
                            {periodMode === 'day'
                              ? st.totalRentedDay
                              : periodMode === 'week'
                              ? st.totalRentedWeek
                              : st.totalRentedMonth}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            D: <strong className="text-[var(--text-muted)]">{st.totalRentedDay}</strong> | W: <strong className="text-[var(--text-muted)]">{st.totalRentedWeek}</strong> | M:{' '}
                            <strong className="text-[var(--text-muted)]">{st.totalRentedMonth}</strong>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: NS OV-FIETS STATION STEENWIJK (SEPARATE MEASUREMENT) */}
        {networkTab === 'ovfiets' && (
          <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 bg-[var(--bg-main)] tabular-nums">
            {/* Top Row: Architectural Capacity Meter & KPI Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Forensic Capacity Box */}
              <div className="lg:col-span-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[5px] p-4 flex flex-col justify-between">
                <div className="text-xs font-bold text-[var(--accent-gold-bright)] uppercase tracking-wider">
                  Actuele Voorraadstatus (ovfietsbeschikbaar.nl)
                </div>

                <div className="my-4 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold font-mono text-[var(--text-main)] tabular-nums">
                        {activeOvFiets.available}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
                        / {activeOvFiets.totalCapacity} vrij ({ovPercentAvailable}%)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[var(--status-emerald)]">
                      LIVE
                    </span>
                  </div>

                  {/* Architectural Linear Bar (no rounded-full) */}
                  <div className="w-full h-3 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[3px] overflow-hidden flex">
                    <div
                      className="h-full bg-[var(--accent-gold)] transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, ovPercentAvailable))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 tabular-nums">
                    <span className="flex items-center gap-1.5 text-[var(--accent-gold-bright)] font-mono">
                      <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--accent-gold)]" />
                      {activeOvFiets.available} Beschikbaar
                    </span>
                    <span className="flex items-center gap-1.5 text-[var(--status-blue)] font-mono">
                      <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--bg-elevated)] border border-[var(--border-focus)]" />
                      {activeOvFiets.rented} Verhuurd
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-dim)] flex items-center justify-between">
                  <span>Update: <strong className="text-[var(--text-muted)]">{activeOvFiets.lastUpdated}</strong></span>
                  <a
                    href={activeOvFiets.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--status-blue)] hover:underline inline-flex items-center gap-1"
                  >
                    <span>swk002</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Right: 4 Dedicated KPI Cards */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* KPI 1: Live Status */}
                <div className="bg-[var(--bg-card)] p-4 rounded-[5px] border border-[var(--border-subtle)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="font-bold text-[var(--text-main)]">Nu Live op Station Steenwijk</span>
                    <img
                      src="/bicycle_parking_open.png"
                      alt="OV-fiets"
                      className="w-5 h-5 object-contain"
                    />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-extrabold font-mono text-[var(--text-main)] tabular-nums">
                      {activeOvFiets.available}{' '}
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        / {activeOvFiets.totalCapacity} beschikbaar
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[var(--status-blue)] mt-1 tabular-nums">
                      Nu actief verhuurd: <strong>{activeOvFiets.rented}</strong> OV-fietsen
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] bg-[var(--bg-main)] p-2 rounded-[4px] border border-[var(--border-subtle)]">
                    Zelfservice stalling Stationsplein 2 · {activeOvFiets.rentalTariff}
                  </div>
                </div>

                {/* KPI 2: Gem. Beschikbaar */}
                <div className="bg-[var(--bg-card)] p-4 rounded-[5px] border border-[var(--border-subtle)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-[var(--status-blue)]">
                    <span className="font-bold">Gem. Beschikbare OV-fietsen</span>
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-blue)]" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-extrabold font-mono text-[var(--status-blue)] tabular-nums">
                      {periodMode === 'day'
                        ? ovfietsStats.avgAvailableDay
                        : periodMode === 'week'
                        ? ovfietsStats.avgAvailableWeek
                        : ovfietsStats.avgAvailableMonth}{' '}
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono mt-1 tabular-nums">
                      Dag: <strong>{ovfietsStats.avgAvailableDay}</strong> · Week:{' '}
                      <strong>{ovfietsStats.avgAvailableWeek}</strong> · Maand:{' '}
                      <strong>{ovfietsStats.avgAvailableMonth}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)]">
                    Typisch beschikbaarheidspatroon: 6 tot 13 fietsen tijdens spitstijden
                  </div>
                </div>

                {/* KPI 3: Gem. Gehuurd */}
                <div className="bg-[var(--bg-card)] p-4 rounded-[5px] border border-[var(--border-subtle)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-[var(--accent-gold-bright)]">
                    <span className="font-bold">Gem. Gehuurde OV-fietsen</span>
                    <Zap className="w-4 h-4 text-[var(--accent-gold)]" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-extrabold font-mono text-[var(--accent-gold-bright)] tabular-nums">
                      {periodMode === 'day'
                        ? ovfietsStats.avgRentedDay
                        : periodMode === 'week'
                        ? ovfietsStats.avgRentedWeek
                        : ovfietsStats.avgRentedMonth}{' '}
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono mt-1 tabular-nums">
                      Dag: <strong>{ovfietsStats.avgRentedDay}</strong> · Week:{' '}
                      <strong>{ovfietsStats.avgRentedWeek}</strong> · Maand:{' '}
                      <strong>{ovfietsStats.avgRentedMonth}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)]">
                    Gemeten over alle uurlijkse metingen van de geselecteerde periode
                  </div>
                </div>

                {/* KPI 4: Totaal Gehuurd */}
                <div className="bg-[var(--bg-card)] p-4 rounded-[5px] border border-[var(--border-subtle)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-[var(--status-emerald)]">
                    <span className="font-bold">Totaal Gehuurde OV-fietsen</span>
                    <TrendingUp className="w-4 h-4 text-[var(--status-emerald)]" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-extrabold font-mono text-[var(--status-emerald)] tabular-nums">
                      {periodMode === 'day'
                        ? ovfietsStats.totalRentedDay
                        : periodMode === 'week'
                        ? ovfietsStats.totalRentedWeek
                        : ovfietsStats.totalRentedMonth}{' '}
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        verhuringen
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono mt-1 tabular-nums">
                      Dag: <strong>{ovfietsStats.totalRentedDay}</strong> · Week:{' '}
                      <strong>{ovfietsStats.totalRentedWeek}</strong> · Maand:{' '}
                      <strong>{ovfietsStats.totalRentedMonth}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] tabular-nums">
                    Vandaag verhuurd: <strong className="text-[var(--text-main)]">{ovfietsStats.totalRentedDay}</strong> verhuringen
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row: Stalling Details & Opening Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[var(--bg-card)] p-4 rounded-[5px] border border-[var(--border-subtle)]">
                <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>Openingstijden Zelfservice Stalling</span>
                </h4>
                <table className="w-full text-xs tabular-nums">
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {activeOvFiets.openingHours.map((oh) => (
                      <tr key={oh.day}>
                        <td className="py-1.5 font-medium text-[var(--text-muted)]">{oh.day}</td>
                        <td className="py-1.5 font-mono text-right font-bold text-[var(--text-main)] tabular-nums">
                          {oh.hours}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-[var(--bg-card)] p-4 rounded-[5px] border border-[var(--border-subtle)] space-y-3">
                <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--status-emerald)]" />
                  <span>Stalling &amp; Slot Specificaties</span>
                </h4>
                <div className="space-y-2 text-xs text-[var(--text-muted)]">
                  <p className="leading-relaxed">
                    Je huurt op <strong className="text-[var(--text-main)]">Station Steenwijk</strong> zelf een OV-fiets met het nieuwe
                    OV-fietsslot, waarbij je <strong className="text-[var(--text-main)]">OV-chipkaart de sleutel</strong> is.
                  </p>
                  <div className="p-2.5 rounded-[4px] bg-[var(--bg-main)] border border-[var(--border-subtle)] text-[var(--text-muted)] space-y-1 text-[11px]">
                    <div className="font-bold text-[var(--accent-gold-bright)] flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-[var(--accent-gold)]" />
                      <span>Volledig losstaand van Deelfiets Nederland</span>
                    </div>
                    <p>
                      OV-fietsen vallen onder NS Fiets (Trans Link Systems / NS Stations) en worden
                      apart geregistreerd onder stationscode <strong className="text-[var(--text-main)] font-mono">swk002</strong>.
                    </p>
                  </div>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportOvFietsStatsCSV}
                      className="px-3 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Download OV-fiets Log (.CSV)</span>
                    </button>
                    <a
                      href="https://ov-fiets.nl/slot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>Meer info ov-fiets.nl/slot</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: Hourly Historical Log Table */}
            <div className="bg-[var(--bg-card)] rounded-[5px] border border-[var(--border-subtle)] overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                <span className="font-bold text-xs text-[var(--text-main)]">
                  Uurlijkse Metingen &amp; Historie (Station Steenwijk, swk002)
                </span>
                <span className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                  {ovfietsLogs.length} geregistreerde snapshots
                </span>
              </div>
              <div className="max-h-60 overflow-auto">
                <table className="w-full text-left border-collapse text-xs tabular-nums">
                  <thead className="bg-[var(--bg-main)] border-b border-[var(--border-subtle)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Tijdstip / Datum</th>
                      <th className="py-2 px-2.5">Uurvak</th>
                      <th className="py-2 px-2.5 text-right">Capaciteit</th>
                      <th className="py-2 px-2.5 text-right font-bold text-[var(--status-emerald)]">
                        Beschikbaar
                      </th>
                      <th className="py-2 px-2.5 text-right font-bold text-[var(--status-blue)]">
                        Verhuurd
                      </th>
                      <th className="py-2 px-3 text-right font-bold text-[var(--accent-gold-bright)]">
                        Nieuwe Verhuringen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] font-mono tabular-nums">
                    {ovfietsLogs.slice(0, 50).map((l) => (
                      <tr key={l.id} className="hover:bg-[var(--bg-card-hover)]">
                        <td className="py-1.5 px-3 font-sans text-[var(--text-main)] tabular-nums">
                          {l.date} {l.hour}
                        </td>
                        <td className="py-1.5 px-2.5 text-[var(--text-dim)]">{l.yearWeek}</td>
                        <td className="py-1.5 px-2.5 text-right text-[var(--text-muted)]">{l.capacity}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-[var(--status-emerald)]">
                          {l.available}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-[var(--status-blue)]">
                          {l.rented}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-[var(--accent-gold-bright)]">
                          {l.newRentals > 0 ? `+${l.newRentals}` : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-2.5 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--accent-gold-bright)]">Dataproduct van Lijst van Andel</span>
            <span className="hidden sm:inline text-[var(--text-dim)]">·</span>
            <span className="hidden sm:inline">
              {networkTab === 'ovfiets'
                ? 'NS OV-fiets Steenwijk (swk002) losstaand verhuuroverzicht'
                : 'Deelfiets Nederland gemeentelijk deelfietsennetwerk'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] font-medium cursor-pointer transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
