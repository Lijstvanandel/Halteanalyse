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

  // Available dates for Deelfiets Nederland
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

  // Doughnut angle calculation for OV-fiets
  const ovPercentAvailable =
    activeOvFiets.totalCapacity > 0
      ? (activeOvFiets.available / activeOvFiets.totalCapacity) * 100
      : 0;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-slate-900">
        {/* Top Header */}
        <div
          className={`text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 border-b shrink-0 transition-colors ${
            networkTab === 'ovfiets'
              ? 'bg-[#000066] border-blue-900'
              : 'bg-[#0086d6] border-sky-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow ${
                networkTab === 'ovfiets'
                  ? 'bg-[#FFCC00] text-[#000066]'
                  : 'bg-[#FFE364] text-slate-950'
              }`}
            >
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
              <h2 className="text-base md:text-lg font-bold tracking-tight">
                {networkTab === 'ovfiets'
                  ? 'NS OV-fiets — Station Steenwijk (Locatie: swk002)'
                  : 'Deelfiets Nederland — Steenwijkerland Verhuurmonitor'}
              </h2>
              <p className="text-xs text-sky-100">
                {networkTab === 'ovfiets'
                  ? 'Officiële zelfservice stalling Stationsplein 2 • Los gemeten van gemeentelijke deelfietsen'
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
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Haal direct actuele voorraad op van ovfietsbeschikbaar.nl"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isScanningOvFiets ? 'animate-spin text-[#FFCC00]' : ''}`}
                />
                <span>{isScanningOvFiets ? 'Scannen...' : 'Nu Live Scannen'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onTriggerLiveScan}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Haal direct actuele voorraad op van deelfietsnederland.nl"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[#FFE364]' : ''}`}
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
                  className="px-3.5 py-1.5 rounded-lg bg-[#FFCC00] hover:bg-amber-300 text-[#000066] text-xs font-bold flex items-center gap-1.5 shadow transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export OV-fiets (.CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportOvFietsRawCSV}
                  className="hidden sm:flex px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold items-center gap-1.5 shadow transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Alle Metingen (.CSV)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleExportDeelfietsStatsCSV}
                  className="px-3.5 py-1.5 rounded-lg bg-[#FFE364] hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Deelfiets Tabel (.CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportDeelfietsRawCSV}
                  className="hidden sm:flex px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold items-center gap-1.5 shadow transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Alle Metingen (.CSV)</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
              title="Sluiten"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Network Switcher Subheader (Explicit Separation) */}
        <div className="bg-slate-200 border-b border-slate-300 px-5 py-2 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mr-1 hidden sm:inline">
              Netwerk:
            </span>
            <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300 shadow-xs">
              <button
                type="button"
                onClick={() => setNetworkTab('deelfiets')}
                className={`px-3.5 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  networkTab === 'deelfiets'
                    ? 'bg-[#0086d6] text-white shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <span>Deelfiets Nederland ({locations.length} hubs)</span>
                <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-900 text-[10px] font-mono">
                  {summary.currentAvailable} vrij
                </span>
              </button>

              <button
                type="button"
                onClick={() => setNetworkTab('ovfiets')}
                className={`px-3.5 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  networkTab === 'ovfiets'
                    ? 'bg-[#000066] text-[#FFCC00] shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <img
                  src="/bicycle_parking_open.png"
                  alt="OV-fiets"
                  className="w-3.5 h-3.5 object-contain"
                />
                <span>NS OV-fiets Station Steenwijk (swk002)</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-300 text-slate-950 text-[10px] font-mono font-black">
                  {activeOvFiets.available} vrij
                </span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-600 hidden md:flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {networkTab === 'ovfiets'
                ? 'Gegevens live gesynchroniseerd met ovfietsbeschikbaar.nl'
                : 'Gegevens live gesynchroniseerd met deelfietsnederland.nl'}
            </span>
          </div>
        </div>

        {/* Filter Bar (Day vs Week vs Month) */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300 shadow-xs">
              <button
                type="button"
                onClick={() => setPeriodMode('day')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  periodMode === 'day'
                    ? networkTab === 'ovfiets'
                      ? 'bg-[#000066] text-[#FFCC00]'
                      : 'bg-[#0086d6] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Per Dag</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('week')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  periodMode === 'week'
                    ? networkTab === 'ovfiets'
                      ? 'bg-[#000066] text-[#FFCC00]'
                      : 'bg-[#0086d6] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Per Week</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  periodMode === 'month'
                    ? networkTab === 'ovfiets'
                      ? 'bg-[#000066] text-[#FFCC00]'
                      : 'bg-[#0086d6] text-white'
                    : 'text-slate-600 hover:text-slate-900'
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
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none"
              >
                {availableDays.map((d) => (
                  <option key={d} value={d}>
                    Dag: {d}
                  </option>
                ))}
              </select>
            )}

            {periodMode === 'week' && (
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none"
              >
                {availableWeeks.map((w) => (
                  <option key={w} value={w}>
                    ISO Week: {w}
                  </option>
                ))}
              </select>
            )}

            {periodMode === 'month' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
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
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none"
              >
                <option value="ALL">Alle plaatsen in Steenwijkerland ({availableTowns.length})</option>
                {availableTowns.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter locatie..."
                  className="bg-white border border-slate-300 rounded-lg pl-8 pr-6 py-1.5 text-xs text-slate-800 focus:outline-none w-44"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          {networkTab === 'ovfiets' && (
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <span className="font-semibold text-[#000066]">Zelfservice stalling</span>
              <span>• Stationsplein 2, 8331 GM Steenwijk</span>
            </div>
          )}
        </div>

        {/* TAB 1: DEELFIETS NEDERLAND CONTENT */}
        {networkTab === 'deelfiets' && (
          <>
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="font-semibold">Nu Live op Locaties</span>
                  <Bike className="w-4 h-4 text-[#0086d6]" />
                </div>
                <div className="text-xl font-black font-mono text-slate-900">
                  {summary.currentAvailable}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {summary.totalCapacity} beschikbaar
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                  Nu actief verhuurd: {summary.currentRented} fietsen
                </div>
              </div>

              <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200 shadow-xs">
                <div className="flex items-center justify-between text-xs text-sky-900 mb-1">
                  <span className="font-semibold">Gem. Beschikbare Fietsen</span>
                  <CheckCircle2 className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-xl font-black font-mono text-sky-900">
                  {periodMode === 'day'
                    ? summary.avgAvailDay
                    : periodMode === 'week'
                    ? summary.avgAvailWeek
                    : summary.avgAvailMonth}{' '}
                  <span className="text-xs font-normal">
                    ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                  </span>
                </div>
                <div className="text-[11px] text-sky-800 mt-0.5 font-mono">
                  Dag: {summary.avgAvailDay} • Week: {summary.avgAvailWeek} • Maand:{' '}
                  {summary.avgAvailMonth}
                </div>
              </div>

              <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 shadow-xs">
                <div className="flex items-center justify-between text-xs text-amber-900 mb-1">
                  <span className="font-semibold">Gem. Gehuurde Fietsen</span>
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl font-black font-mono text-amber-900">
                  {periodMode === 'day'
                    ? summary.avgRentedDay
                    : periodMode === 'week'
                    ? summary.avgRentedWeek
                    : summary.avgRentedMonth}{' '}
                  <span className="text-xs font-normal">
                    ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                  </span>
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5 font-mono">
                  Dag: {summary.avgRentedDay} • Week: {summary.avgRentedWeek} • Maand:{' '}
                  {summary.avgRentedMonth}
                </div>
              </div>

              <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 shadow-xs">
                <div className="flex items-center justify-between text-xs text-emerald-900 mb-1">
                  <span className="font-semibold">Totaal Gehuurde Fietsen</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-black font-mono text-emerald-900">
                  {periodMode === 'day'
                    ? summary.totalRentedDay
                    : periodMode === 'week'
                    ? summary.totalRentedWeek
                    : summary.totalRentedMonth}{' '}
                  <span className="text-xs font-normal">
                    verhuringen ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                  </span>
                </div>
                <div className="text-[11px] text-emerald-800 mt-0.5 font-mono">
                  Dag: {summary.totalRentedDay} • Week: {summary.totalRentedWeek} • Maand:{' '}
                  {summary.totalRentedMonth}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 font-bold">Plaats & Deelfietslocatie</th>
                    <th className="py-2.5 px-2.5 font-bold">Adres & Type</th>
                    <th className="py-2.5 px-2.5 font-bold text-right">Nu Live (Beschikbaar / Cap.)</th>
                    <th className="py-2.5 px-2.5 font-bold text-right bg-sky-50/80 text-sky-900">
                      Gem. Beschikbaar
                      <div className="text-[9px] font-normal text-sky-700">Dag | Week | Maand</div>
                    </th>
                    <th className="py-2.5 px-2.5 font-bold text-right bg-amber-50/80 text-amber-900">
                      Gem. Gehuurd
                      <div className="text-[9px] font-normal text-amber-700">Dag | Week | Maand</div>
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right bg-emerald-50/80 text-emerald-900">
                      Totaal Gehuurd
                      <div className="text-[9px] font-normal text-emerald-700">Dag | Week | Maand</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {statsList.map((st) => (
                    <tr key={st.stationId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#0086d6] shrink-0" />
                          <span>
                            {st.town} — {st.locationName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-slate-600">
                        <div>{st.streetAddress}</div>
                        <span
                          className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            st.isCargoBike
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {st.isCargoBike ? 'Elektrische Deelbakfiets' : 'Elektrische Deelfiets'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            st.currentAvailable > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {st.currentAvailable} / {st.capacity}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Nu verhuurd: {st.currentRented}
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono bg-sky-50/30">
                        <div className="font-bold text-sky-900 text-sm">
                          {periodMode === 'day'
                            ? st.avgAvailableDay
                            : periodMode === 'week'
                            ? st.avgAvailableWeek
                            : st.avgAvailableMonth}
                        </div>
                        <div className="text-[10px] text-slate-600">
                          D: <strong>{st.avgAvailableDay}</strong> | W: <strong>{st.avgAvailableWeek}</strong> | M:{' '}
                          <strong>{st.avgAvailableMonth}</strong>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono bg-amber-50/30">
                        <div className="font-bold text-amber-900 text-sm">
                          {periodMode === 'day'
                            ? st.avgRentedDay
                            : periodMode === 'week'
                            ? st.avgRentedWeek
                            : st.avgRentedMonth}
                        </div>
                        <div className="text-[10px] text-slate-600">
                          D: <strong>{st.avgRentedDay}</strong> | W: <strong>{st.avgRentedWeek}</strong> | M:{' '}
                          <strong>{st.avgRentedMonth}</strong>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono bg-emerald-50/30">
                        <div className="font-bold text-emerald-900 text-sm">
                          {periodMode === 'day'
                            ? st.totalRentedDay
                            : periodMode === 'week'
                            ? st.totalRentedWeek
                            : st.totalRentedMonth}
                        </div>
                        <div className="text-[10px] text-slate-600">
                          D: <strong>{st.totalRentedDay}</strong> | W: <strong>{st.totalRentedWeek}</strong> | M:{' '}
                          <strong>{st.totalRentedMonth}</strong>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TAB 2: NS OV-FIETS STATION STEENWIJK (SEPARATE MEASUREMENT) */}
        {networkTab === 'ovfiets' && (
          <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
            {/* Top Row: Gauge & KPI Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Gauge Box matching ovfietsbeschikbaar.nl */}
              <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-xs">
                <div className="text-xs font-bold text-[#000066] uppercase tracking-wider mb-2">
                  Actuele Beschikbaarheid (ovfietsbeschikbaar.nl)
                </div>

                {/* Semicircle Gauge Visual */}
                <div className="relative w-56 h-28 my-2 overflow-hidden flex items-end justify-center">
                  <div
                    className="w-56 h-56 rounded-full border-[20px] absolute top-0"
                    style={{
                      borderColor: '#d8f2fc',
                      borderTopColor: '#000066',
                      borderLeftColor: '#000066',
                      transform: `rotate(${Math.min(180, (ovPercentAvailable / 100) * 180 - 45)}deg)`,
                      transition: 'transform 0.5s ease',
                    }}
                  />
                  <div className="relative z-10 flex flex-col items-center pb-1">
                    <div className="flex items-center gap-1">
                      <span className="text-4xl font-black font-mono text-[#000066]">
                        {activeOvFiets.available}
                      </span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[#000066] text-white">
                        live
                      </span>
                    </div>
                    <span className="text-xs text-slate-600 font-medium">van de {activeOvFiets.totalCapacity} fietsen vrij</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 text-xs font-semibold mt-2 pt-2 border-t border-slate-200 w-full">
                  <span className="flex items-center gap-1.5 text-[#000066]">
                    <span className="w-3 h-3 rounded-full bg-[#000066]" />
                    {activeOvFiets.available} Beschikbaar
                  </span>
                  <span className="flex items-center gap-1.5 text-sky-800">
                    <span className="w-3 h-3 rounded-full bg-[#d8f2fc] border border-sky-300" />
                    {activeOvFiets.rented} Verhuurd
                  </span>
                </div>

                <div className="mt-3 text-[11px] text-slate-500">
                  Laatste update: <strong>{activeOvFiets.lastUpdated}</strong> • Bron:{' '}
                  <a
                    href={activeOvFiets.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0086d6] hover:underline inline-flex items-center gap-1"
                  >
                    <span>OVfietsbeschikbaar.nl/locatie/swk002</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Right: 4 Dedicated KPI Cards */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* KPI 1: Live Status */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold text-slate-700">Nu Live op Station Steenwijk</span>
                    <img
                      src="/bicycle_parking_open.png"
                      alt="OV-fiets"
                      className="w-5 h-5 object-contain"
                    />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black font-mono text-[#000066]">
                      {activeOvFiets.available}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        / {activeOvFiets.totalCapacity} beschikbaar
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-blue-900 mt-1">
                      Nu actief verhuurd: <strong>{activeOvFiets.rented}</strong> OV-fietsen
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                    Zelfservice stalling Stationsplein 2 • {activeOvFiets.rentalTariff}
                  </div>
                </div>

                {/* KPI 2: Gem. Beschikbaar */}
                <div className="bg-sky-50/70 p-4 rounded-xl border border-sky-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-sky-900">
                    <span className="font-bold">Gem. Beschikbare OV-fietsen</span>
                    <CheckCircle2 className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black font-mono text-sky-950">
                      {periodMode === 'day'
                        ? ovfietsStats.avgAvailableDay
                        : periodMode === 'week'
                        ? ovfietsStats.avgAvailableWeek
                        : ovfietsStats.avgAvailableMonth}{' '}
                      <span className="text-xs font-normal text-sky-800">
                        ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                      </span>
                    </div>
                    <div className="text-xs text-sky-900 font-mono mt-1">
                      Dag: <strong>{ovfietsStats.avgAvailableDay}</strong> • Week:{' '}
                      <strong>{ovfietsStats.avgAvailableWeek}</strong> • Maand:{' '}
                      <strong>{ovfietsStats.avgAvailableMonth}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-sky-700">
                    Typisch beschikbaarheidspatroon: 6 tot 13 fietsen tijdens spitstijden
                  </div>
                </div>

                {/* KPI 3: Gem. Gehuurd */}
                <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-amber-900">
                    <span className="font-bold">Gem. Gehuurde OV-fietsen</span>
                    <Zap className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black font-mono text-amber-950">
                      {periodMode === 'day'
                        ? ovfietsStats.avgRentedDay
                        : periodMode === 'week'
                        ? ovfietsStats.avgRentedWeek
                        : ovfietsStats.avgRentedMonth}{' '}
                      <span className="text-xs font-normal text-amber-800">
                        ({periodMode === 'day' ? 'dag' : periodMode === 'week' ? 'week' : 'maand'})
                      </span>
                    </div>
                    <div className="text-xs text-amber-900 font-mono mt-1">
                      Dag: <strong>{ovfietsStats.avgRentedDay}</strong> • Week:{' '}
                      <strong>{ovfietsStats.avgRentedWeek}</strong> • Maand:{' '}
                      <strong>{ovfietsStats.avgRentedMonth}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-amber-800">
                    Gemeten over alle uurlijkse metingen van de geselecteerde periode
                  </div>
                </div>

                {/* KPI 4: Totaal Gehuurd */}
                <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-emerald-900">
                    <span className="font-bold">Totaal Gehuurde OV-fietsen</span>
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black font-mono text-emerald-950">
                      {periodMode === 'day'
                        ? ovfietsStats.totalRentedDay
                        : periodMode === 'week'
                        ? ovfietsStats.totalRentedWeek
                        : ovfietsStats.totalRentedMonth}{' '}
                      <span className="text-xs font-normal text-emerald-800">
                        verhuringen
                      </span>
                    </div>
                    <div className="text-xs text-emerald-900 font-mono mt-1">
                      Dag: <strong>{ovfietsStats.totalRentedDay}</strong> • Week:{' '}
                      <strong>{ovfietsStats.totalRentedWeek}</strong> • Maand:{' '}
                      <strong>{ovfietsStats.totalRentedMonth}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Vandaag verhuurd: <strong>{ovfietsStats.totalRentedDay}</strong> verhuringen
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row: Stalling Details & Opening Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#000066]" />
                  <span>Openingstijden Zelfservice Stalling</span>
                </h4>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {activeOvFiets.openingHours.map((oh) => (
                      <tr key={oh.day} className="py-1">
                        <td className="py-1.5 font-medium text-slate-700">{oh.day}</td>
                        <td className="py-1.5 font-mono text-right font-bold text-[#000066]">
                          {oh.hours}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Stalling & Slot Specificaties</span>
                </h4>
                <div className="space-y-2 text-xs text-slate-700">
                  <p className="leading-relaxed">
                    Je huurt op <strong>Station Steenwijk</strong> zelf een OV-fiets met het nieuwe
                    OV-fietsslot, waarbij je <strong>OV-chipkaart de sleutel</strong> is.
                  </p>
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-1 text-[11px]">
                    <div className="font-bold flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-amber-700" />
                      <span>Volledig losstaand van Deelfiets Nederland</span>
                    </div>
                    <p>
                      OV-fietsen vallen onder NS Fiets (Trans Link Systems / NS Stations) en worden
                      apart geregistreerd onder stationscode <strong>swk002</strong>.
                    </p>
                  </div>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportOvFietsStatsCSV}
                      className="px-3 py-1.5 rounded-lg bg-[#000066] text-[#FFCC00] text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer hover:bg-blue-950 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Download OV-fiets Log (.CSV)</span>
                    </button>
                    <a
                      href="https://ov-fiets.nl/slot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>Meer info ov-fiets.nl/slot</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: Hourly Historical Log Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  Uurlijkse Metingen & Historie (Station Steenwijk, swk002)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {ovfietsLogs.length} geregistreerde snapshots
                </span>
              </div>
              <div className="max-h-60 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Tijdstip / Datum</th>
                      <th className="py-2 px-2.5">Uurvak</th>
                      <th className="py-2 px-2.5 text-right">Capaciteit</th>
                      <th className="py-2 px-2.5 text-right font-bold text-[#000066]">
                        Beschikbaar
                      </th>
                      <th className="py-2 px-2.5 text-right font-bold text-blue-800">
                        Verhuurd
                      </th>
                      <th className="py-2 px-3 text-right font-bold text-emerald-800">
                        Nieuwe Verhuringen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {ovfietsLogs.slice(0, 50).map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-sans text-slate-800">
                          {l.date} {l.hour}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600">{l.yearWeek}</td>
                        <td className="py-1.5 px-2.5 text-right text-slate-500">{l.capacity}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-emerald-700">
                          {l.available}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-blue-800">
                          {l.rented}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-700">
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
        <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#FFCC00]">Dataproduct van Lijst van Andel</span>
            <span className="hidden sm:inline text-slate-500">•</span>
            <span className="hidden sm:inline">
              {networkTab === 'ovfiets'
                ? 'NS OV-fiets Steenwijk (swk002) losstaand verhuuroverzicht'
                : 'Deelfiets Nederland gemeentelijk deelfietsennetwerk'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium cursor-pointer transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
