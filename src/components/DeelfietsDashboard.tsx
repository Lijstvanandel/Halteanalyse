import React, { useMemo, useState, useEffect } from 'react';
import {
  DeelfietsLocation,
  DeelfietsLogEntry,
  aggregateDeelfietsStats,
  exportDeelfietsStatsToCSV,
  exportRawDeelfietsLogsToCSV,
} from '../utils/deelfiets';
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
} from 'lucide-react';

interface DeelfietsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  locations: DeelfietsLocation[];
  logs: DeelfietsLogEntry[];
  initialLocationFilter?: string;
  onTriggerLiveScan: () => void;
  isScanning: boolean;
}

export const DeelfietsDashboard: React.FC<DeelfietsDashboardProps> = ({
  isOpen,
  onClose,
  locations,
  logs,
  initialLocationFilter = '',
  onTriggerLiveScan,
  isScanning,
}) => {
  const nowInfo = useMemo(() => getISOWeekInfo(new Date()), []);

  const [periodMode, setPeriodMode] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDay, setSelectedDay] = useState<string>(nowInfo.dateStr);
  const [selectedWeek, setSelectedWeek] = useState<string>(nowInfo.yearWeek);
  const [selectedMonth, setSelectedMonth] = useState<string>(nowInfo.yearMonth);
  const [selectedTown, setSelectedTown] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>(initialLocationFilter);

  useEffect(() => {
    if (initialLocationFilter !== undefined) {
      setSearchQuery(initialLocationFilter);
    }
  }, [initialLocationFilter]);

  const availableDays = useMemo(() => {
    const s = new Set<string>([nowInfo.dateStr]);
    logs.forEach((l) => s.add(l.date));
    return Array.from(s).sort().reverse();
  }, [logs, nowInfo.dateStr]);

  const availableWeeks = useMemo(() => {
    const s = new Set<string>([nowInfo.yearWeek]);
    logs.forEach((l) => s.add(l.yearWeek));
    return Array.from(s).sort().reverse();
  }, [logs, nowInfo.yearWeek]);

  const availableMonths = useMemo(() => {
    const s = new Set<string>([nowInfo.yearMonth]);
    logs.forEach((l) => s.add(l.yearMonth));
    return Array.from(s).sort().reverse();
  }, [logs, nowInfo.yearMonth]);

  const availableTowns = useMemo(() => {
    const s = new Set<string>();
    locations.forEach((loc) => s.add(loc.town));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'nl'));
  }, [locations]);

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

  // Municipality-wide totals & averages across filtered locations
  const summary = useMemo(() => {
    const currentAvailable = statsList.reduce((a, b) => a + b.currentAvailable, 0);
    const currentRented = statsList.reduce((a, b) => a + b.currentRented, 0);
    const totalCapacity = statsList.reduce((a, b) => a + b.capacity, 0);

    // Sum of average available bikes across the hubs in Steenwijkerland
    const avgAvailDay = Number(
      statsList.reduce((a, b) => a + b.avgAvailableDay, 0).toFixed(1)
    );
    const avgAvailWeek = Number(
      statsList.reduce((a, b) => a + b.avgAvailableWeek, 0).toFixed(1)
    );
    const avgAvailMonth = Number(
      statsList.reduce((a, b) => a + b.avgAvailableMonth, 0).toFixed(1)
    );

    // Sum of average rented bikes across the hubs in Steenwijkerland
    const avgRentedDay = Number(
      statsList.reduce((a, b) => a + b.avgRentedDay, 0).toFixed(1)
    );
    const avgRentedWeek = Number(
      statsList.reduce((a, b) => a + b.avgRentedWeek, 0).toFixed(1)
    );
    const avgRentedMonth = Number(
      statsList.reduce((a, b) => a + b.avgRentedMonth, 0).toFixed(1)
    );

    // Total rented bikes (day / week / month) across Steenwijkerland
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

  const handleExportStatsCSV = () => {
    const periodTag =
      periodMode === 'day'
        ? selectedDay
        : periodMode === 'week'
        ? selectedWeek
        : selectedMonth;
    const csv = exportDeelfietsStatsToCSV(statsList);
    downloadCSV(csv, `steenwijkerland_deelfietsen_statistieken_${periodTag}.csv`);
  };

  const handleExportRawCSV = () => {
    const csv = exportRawDeelfietsLogsToCSV(logs);
    downloadCSV(csv, `steenwijkerland_deelfietsen_ruwe_metingen.csv`);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-slate-900">
        {/* Top Header */}
        <div className="bg-[#0086d6] text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-sky-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE364] flex items-center justify-center text-slate-950 font-black shadow">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold tracking-tight">
                Deelfiets Nederland — Steenwijkerland Beschikbaarheid & Verhuurmonitor
              </h2>
              <p className="text-xs text-sky-100">
                Live monitoring van alle {locations.length} deelfietslocaties in Steenwijkerland (per dag, per week en per maand)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            <button
              type="button"
              onClick={handleExportStatsCSV}
              className="px-3.5 py-1.5 rounded-lg bg-[#FFE364] hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Deelfiets Tabel (.CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleExportRawCSV}
              className="hidden sm:flex px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold items-center gap-1.5 shadow transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Alle Metingen (.CSV)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Sluiten"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* Period Switch: Day vs Week vs Month */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300 shadow-xs">
              <button
                type="button"
                onClick={() => setPeriodMode('day')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  periodMode === 'day'
                    ? 'bg-[#0086d6] text-white'
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
                    ? 'bg-[#0086d6] text-white'
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
                    ? 'bg-[#0086d6] text-white'
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
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-[#0086d6]"
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
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-[#0086d6]"
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
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-[#0086d6]"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    Maand: {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Location & Town Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTown}
              onChange={(e) => setSelectedTown(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-[#0086d6]"
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
                placeholder="Filter locatie of adres..."
                className="bg-white border border-slate-300 rounded-lg pl-8 pr-6 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#0086d6] w-48"
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
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          {/* Card 1: Live Available & Capacity */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold">Nu Live op Locaties</span>
              <Bike className="w-4 h-4 text-[#0086d6]" />
            </div>
            <div className="text-xl font-black font-mono text-slate-900">
              {summary.currentAvailable} <span className="text-xs font-normal text-slate-500">/ {summary.totalCapacity} beschikbaar</span>
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              Nu actief verhuurd: {summary.currentRented} fietsen
            </div>
          </div>

          {/* Card 2: Gemiddeld Beschikbare Fietsen (Dag / Week / Maand) */}
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
              Dag: {summary.avgAvailDay} • Week: {summary.avgAvailWeek} • Maand: {summary.avgAvailMonth}
            </div>
          </div>

          {/* Card 3: Gemiddeld Gehuurde Fietsen (Dag / Week / Maand) */}
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
              Dag: {summary.avgRentedDay} • Week: {summary.avgRentedWeek} • Maand: {summary.avgRentedMonth}
            </div>
          </div>

          {/* Card 4: Totaal Aantal Gehuurde Fietsen (Dag / Week / Maand) */}
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
              Dag: {summary.totalRentedDay} • Week: {summary.totalRentedWeek} • Maand: {summary.totalRentedMonth}
            </div>
          </div>
        </div>

        {/* Main Table */}
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
                      <span>{st.town} — {st.locationName}</span>
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
                      D: <strong>{st.avgAvailableDay}</strong> | W: <strong>{st.avgAvailableWeek}</strong> | M: <strong>{st.avgAvailableMonth}</strong>
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
                      D: <strong>{st.avgRentedDay}</strong> | W: <strong>{st.avgRentedWeek}</strong> | M: <strong>{st.avgRentedMonth}</strong>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono bg-emerald-50/30">
                    <div className="font-bold text-emerald-800 text-sm">
                      {periodMode === 'day'
                        ? st.totalRentedDay
                        : periodMode === 'week'
                        ? st.totalRentedWeek
                        : st.totalRentedMonth}{' '}
                      <span className="text-[10px] font-normal">verhuurd</span>
                    </div>
                    <div className="text-[10px] text-slate-600">
                      D: <strong>{st.totalRentedDay}</strong> | W: <strong>{st.totalRentedWeek}</strong> | M: <strong>{st.totalRentedMonth}</strong>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 shrink-0">
          <div>
            Bron: <strong>deelfietsnederland.nl/locaties</strong> (`/api/droppoints-v2/nl`) • Alle {locations.length} hubs binnen Gemeente Steenwijkerland • Automatische 24/7 logging in `deelfietsLogs.json`
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold cursor-pointer"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
