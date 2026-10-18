import React, { useMemo, useState } from 'react';
import { BusStop } from '../types/bus';
import {
  PunctualityLogEntry,
  PunctualityFilter,
  computeStopStats,
  computeLineStats,
  exportStopStatsToCSV,
  exportLineStatsToCSV,
  exportRawLogsToCSV,
  filterPunctualityLogs,
  getISOWeekInfo,
} from '../utils/punctuality';
import {
  X,
  Download,
  BarChart3,
  Clock,
  AlertOctagon,
  FastForward,
  CheckCircle2,
  Calendar,
  Search,
  Bus,
  MapPin,
  RefreshCw,
  FileSpreadsheet,
  Cloud,
  LogOut,
} from 'lucide-react';

interface PunctualityDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  logs: PunctualityLogEntry[];
  stops: BusStop[];
  initialStopFilter?: string;
  onTriggerLiveScan: () => void;
  isScanning: boolean;
  firebaseUserEmail?: string | null;
  isCloudSyncing?: boolean;
  onCloudSync?: () => void;
  onSignOut?: () => void;
}

function triggerCsvDownload(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const PunctualityDashboard: React.FC<PunctualityDashboardProps> = ({
  isOpen,
  onClose,
  logs,
  stops,
  initialStopFilter = '',
  onTriggerLiveScan,
  isScanning,
  firebaseUserEmail,
  isCloudSyncing = false,
  onCloudSync,
  onSignOut,
}) => {
  const todayInfo = useMemo(() => getISOWeekInfo(new Date()), []);

  const [activeTab, setActiveTab] = useState<'stops' | 'lines' | 'raw'>('stops');
  const [periodType, setPeriodType] = useState<'all' | 'month' | 'week'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(todayInfo.yearMonth);
  const [selectedWeek, setSelectedWeek] = useState<string>(todayInfo.yearWeek);
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>(initialStopFilter);

  React.useEffect(() => {
    if (initialStopFilter) {
      setSearchQuery(initialStopFilter);
      setActiveTab('stops');
    }
  }, [initialStopFilter]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>([todayInfo.yearMonth]);
    logs.forEach((l) => set.add(l.yearMonth));
    return Array.from(set).sort().reverse();
  }, [logs, todayInfo.yearMonth]);

  const availableWeeks = useMemo(() => {
    const set = new Set<string>([todayInfo.yearWeek]);
    logs.forEach((l) => set.add(l.yearWeek));
    return Array.from(set).sort().reverse();
  }, [logs, todayInfo.yearWeek]);

  const availableLines = useMemo(() => {
    const set = new Set<string>(['18', '20', '26', '70', '71', '76', '146', '171', '214', '217', '270', '524', '675', '679']);
    logs.forEach((l) => set.add(l.line));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [logs]);

  const filter: PunctualityFilter = useMemo(
    () => ({
      periodType,
      yearMonth: selectedMonth,
      yearWeek: selectedWeek,
      line: selectedLine,
      searchQuery,
    }),
    [periodType, selectedMonth, selectedWeek, selectedLine, searchQuery]
  );

  const periodLabel = useMemo(() => {
    if (periodType === 'month') return `Maand_${selectedMonth}`;
    if (periodType === 'week') return `Week_${selectedWeek}`;
    return `Vanaf_${todayInfo.dateStr}`;
  }, [periodType, selectedMonth, selectedWeek, todayInfo.dateStr]);

  const stopStats = useMemo(
    () => computeStopStats(logs, stops, filter),
    [logs, stops, filter]
  );

  const lineStats = useMemo(
    () => computeLineStats(logs, filter),
    [logs, filter]
  );

  const filteredRawLogs = useMemo(
    () => filterPunctualityLogs(logs, filter),
    [logs, filter]
  );

  // Overall summary KPIs for the current filter
  const summary = useMemo(() => {
    const total = filteredRawLogs.length;
    const cancelled = filteredRawLogs.filter((e) => e.status === 'cancelled');
    const operated = filteredRawLogs.filter((e) => e.status !== 'cancelled');
    const delayed = operated.filter((e) => e.status === 'delayed' || e.delayMinutes > 0);
    const early = operated.filter((e) => e.status === 'early' || e.delayMinutes < 0);
    const onTime = operated.filter((e) => e.status === 'ontime' && e.delayMinutes === 0);

    const sumDelay = delayed.reduce((a, e) => a + Math.max(0, e.delayMinutes), 0);
    const avgDelay = delayed.length > 0 ? (sumDelay / delayed.length).toFixed(1) : '0.0';

    const sumEarly = early.reduce((a, e) => a + Math.abs(Math.min(0, e.delayMinutes)), 0);
    const avgEarly = early.length > 0 ? (sumEarly / early.length).toFixed(1) : '0.0';

    return {
      total,
      cancelledCount: cancelled.length,
      delayedCount: delayed.length,
      avgDelay,
      earlyCount: early.length,
      avgEarly,
      onTimeCount: onTime.length,
    };
  }, [filteredRawLogs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white w-full max-w-6xl h-[92vh] rounded-2xl border border-slate-300 shadow-2xl flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="bg-[#0E518D] text-white px-5 py-4 flex items-center justify-between border-b border-[#0A3D6B] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFCC00] text-slate-950 flex items-center justify-center font-bold shadow">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  OV Stiptheid, Vertraging & Uitval Logboek — Gemeente Steenwijkerland
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500 text-white">
                  Actieve Logging vanaf {todayInfo.dateStr}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Analyse per bushalte en per lijnnummer op maand- en weekbasis • Permanent opgeslagen & exporteerbaar als .CSV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCloudSync && (
              <button
                onClick={onCloudSync}
                disabled={isCloudSyncing}
                className="px-3 py-1.5 rounded-lg bg-[#FFCC00] hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title={
                  firebaseUserEmail
                    ? `Gesynchroniseerd met Firebase Firestore (${firebaseUserEmail})`
                    : 'Log in met Google om logboek in Firebase Firestore te synchroniseren'
                }
              >
                <Cloud className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
                <span className="hidden md:inline">
                  {firebaseUserEmail ? `Cloud Sync (${firebaseUserEmail})` : 'Firebase Cloud Sync'}
                </span>
              </button>
            )}
            {firebaseUserEmail && onSignOut && (
              <button
                onClick={onSignOut}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 text-xs transition-colors cursor-pointer"
                title="Uitloggen bij Firebase"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onTriggerLiveScan}
              disabled={isScanning}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Log direct actuele DRGL ritten"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Nu Loggen (DRGL)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar (Maand / Weeknummer / Lijn / Zoek + CSV Export) */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Type Selector */}
            <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => setPeriodType('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'all' ? 'bg-[#0E518D] text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Vanaf Vandaag ({todayInfo.dateStr})
              </button>
              <button
                onClick={() => setPeriodType('month')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'month' ? 'bg-[#0E518D] text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Per Maand
              </button>
              <button
                onClick={() => setPeriodType('week')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'week' ? 'bg-[#0E518D] text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Per Weeknummer
              </button>
            </div>

            {/* Month Dropdown */}
            {periodType === 'month' && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-[#0E518D]" />
                <span className="text-slate-500 font-medium">Maand:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="font-bold text-slate-900 bg-transparent focus:outline-none"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Week Dropdown */}
            {periodType === 'week' && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-[#0E518D]" />
                <span className="text-slate-500 font-medium">Week:</span>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="font-bold text-slate-900 bg-transparent focus:outline-none"
                >
                  {availableWeeks.map((w) => (
                    <option key={w} value={w}>
                      Week {w.split('-W')[1]} ({w.split('-W')[0]})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Line Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
              <Bus className="w-3.5 h-3.5 text-[#0E518D]" />
              <span className="text-slate-500 font-medium">Lijn:</span>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="font-bold text-slate-900 bg-transparent focus:outline-none"
              >
                <option value="ALL">Alle lijnen ({availableLines.length})</option>
                {availableLines.map((l) => (
                  <option key={l} value={l}>
                    Lijn {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Stop / Town */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek plaats of haltenaam..."
                className="pl-8 pr-6 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E518D] w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-700 text-xs"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* CSV Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                triggerCsvDownload(
                  exportStopStatsToCSV(stopStats, periodLabel),
                  `steenwijkerland_haltes_vertraging_${periodLabel}.csv`
                )
              }
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Haltes (.csv)</span>
            </button>

            <button
              onClick={() =>
                triggerCsvDownload(
                  exportLineStatsToCSV(lineStats, periodLabel),
                  `steenwijkerland_lijnen_vertraging_${periodLabel}.csv`
                )
              }
              className="px-3 py-1.5 rounded-lg bg-[#0E518D] hover:bg-[#0A3D6B] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Lijnen (.csv)</span>
            </button>

            <button
              onClick={() =>
                triggerCsvDownload(
                  exportRawLogsToCSV(filteredRawLogs),
                  `steenwijkerland_ruwe_logdata_${periodLabel}.csv`
                )
              }
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              title="Exporteer alle individuele gelogde rit-passages als CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#FFCC00]" />
              <span className="hidden md:inline">Alle Logregels (.csv)</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 shrink-0 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-500 font-medium">Gelogde Halte-passages</div>
            <div className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">
              {summary.total}
            </div>
          </div>

          <div className="bg-red-50/70 p-2.5 rounded-xl border border-red-200 shadow-xs">
            <div className="text-red-700 font-semibold flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5" /> Uitgevallen Ritten
            </div>
            <div className="text-lg font-extrabold text-red-700 font-mono mt-0.5">
              {summary.cancelledCount}
            </div>
          </div>

          <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 shadow-xs">
            <div className="text-amber-800 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Gem. Vertraging (Te laat)
            </div>
            <div className="text-lg font-extrabold text-amber-800 font-mono mt-0.5">
              +{summary.avgDelay} min{' '}
              <span className="text-[11px] font-normal">({summary.delayedCount} ritten)</span>
            </div>
          </div>

          <div className="bg-sky-50/70 p-2.5 rounded-xl border border-sky-200 shadow-xs">
            <div className="text-sky-800 font-semibold flex items-center gap-1">
              <FastForward className="w-3.5 h-3.5" /> Te Vroeg Gepasseerd
            </div>
            <div className="text-lg font-extrabold text-sky-800 font-mono mt-0.5">
              {summary.earlyCount} ritten{' '}
              <span className="text-[11px] font-normal">(gem. -{summary.avgEarly} min)</span>
            </div>
          </div>

          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 shadow-xs col-span-2 sm:col-span-1">
            <div className="text-emerald-800 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Stipt Op Tijd
            </div>
            <div className="text-lg font-extrabold text-emerald-700 font-mono mt-0.5">
              {summary.onTimeCount} ritten
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-2 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('stops')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'stops'
                ? 'border-[#0E518D] text-[#0E518D]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Per Bushalte ({stopStats.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('lines')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'lines'
                ? 'border-[#0E518D] text-[#0E518D]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bus className="w-3.5 h-3.5" />
            <span>Per Lijnnummer ({lineStats.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'raw'
                ? 'border-[#0E518D] text-[#0E518D]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Individuele Logregels ({filteredRawLogs.length})</span>
          </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'stops' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2.5 px-3">Plaats</th>
                    <th className="py-2.5 px-3">Haltenaam</th>
                    <th className="py-2.5 px-3">Lijnen</th>
                    <th className="py-2.5 px-3 text-right">Gelogde Ritten</th>
                    <th className="py-2.5 px-3 text-right text-red-700">Uitgevallen Ritten</th>
                    <th className="py-2.5 px-3 text-right text-amber-800">
                      Vertraagde Ritten & Gem. Vertraging
                    </th>
                    <th className="py-2.5 px-3 text-right text-sky-800">
                      Te Vroeg Gepasseerd & Gem. Minuten
                    </th>
                    <th className="py-2.5 px-3 text-right text-emerald-700">Op Tijd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {stopStats.map((s) => (
                    <tr key={`${s.town}-${s.stopName}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{s.town}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#0E518D]">{s.stopName}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {s.lines.map((l) => (
                            <span
                              key={l}
                              className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px] font-bold text-slate-800"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {s.totalRecordedTrips}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={
                            s.cancelledCount > 0
                              ? 'px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold'
                              : 'text-slate-500'
                          }
                        >
                          {s.cancelledCount} ({s.cancelledPercent}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-bold text-amber-800">
                          +{s.avgDelayWhenDelayedMin} min{' '}
                          <span className="text-[10px] font-normal text-slate-500">
                            ({s.delayedCount}x te laat)
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Alle ritten: +{s.avgDelayAllOperatedMin} min
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-bold text-sky-800">
                          {s.earlyCount}x te vroeg
                        </div>
                        <div className="text-[10px] text-sky-700">
                          Gem. -{s.avgEarlyMinutes} min te vroeg
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {s.onTimeCount} ({s.onTimePercent}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'lines' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2.5 px-3">Lijn</th>
                    <th className="py-2.5 px-3">Vervoerder</th>
                    <th className="py-2.5 px-3">Traject in Steenwijkerland</th>
                    <th className="py-2.5 px-3 text-right">Gelogde Passages</th>
                    <th className="py-2.5 px-3 text-right text-red-700">Uitgevallen Ritten</th>
                    <th className="py-2.5 px-3 text-right text-amber-800">
                      Vertraagd & Gem. Vertraging
                    </th>
                    <th className="py-2.5 px-3 text-right text-sky-800">
                      Te Vroeg Gepasseerd & Gem. Minuten
                    </th>
                    <th className="py-2.5 px-3 text-right text-emerald-700">Op Tijd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lineStats.map((l) => (
                    <tr key={l.line} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <span className="px-2.5 py-1 rounded bg-[#0E518D] text-white font-mono font-bold text-xs">
                          Lijn {l.line}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{l.operator}</td>
                      <td className="py-2.5 px-3 text-slate-600">{l.routeSummary}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {l.totalRecordedTrips}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={
                            l.cancelledCount > 0
                              ? 'px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold'
                              : 'text-slate-500'
                          }
                        >
                          {l.cancelledCount} ({l.cancelledPercent}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-bold text-amber-800">
                          +{l.avgDelayWhenDelayedMin} min{' '}
                          <span className="text-[10px] font-normal text-slate-500">
                            ({l.delayedCount}x)
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Alle ritten: +{l.avgDelayAllOperatedMin} min
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-bold text-sky-800">{l.earlyCount}x te vroeg</div>
                        <div className="text-[10px] text-sky-700">
                          Gem. -{l.avgEarlyMinutes} min te vroeg
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {l.onTimeCount} ({l.onTimePercent}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2 px-3">Datum & Week</th>
                    <th className="py-2 px-3">Plaats & Haltenaam</th>
                    <th className="py-2 px-3">Lijn & Richting</th>
                    <th className="py-2 px-3">Gepland</th>
                    <th className="py-2 px-3">Werkelijk</th>
                    <th className="py-2 px-3">Status & Afwijking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRawLogs.slice(0, 250).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                        <div>{log.date}</div>
                        <div className="text-[10px] text-slate-400">
                          {log.yearWeek} • Maand {log.yearMonth}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-900">{log.town}</span> —{' '}
                        <span className="font-semibold text-[#0E518D]">{log.stopName}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono font-bold text-[10px] mr-1.5">
                          Lijn {log.line}
                        </span>
                        <span className="text-slate-700">{log.destination}</span>
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold">{log.plannedTime}</td>
                      <td className="py-2 px-3 font-mono font-semibold">{log.actualTime}</td>
                      <td className="py-2 px-3 font-mono">
                        {log.status === 'cancelled' && (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                            Uitgevallen
                          </span>
                        )}
                        {log.status === 'delayed' && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                            Vertraagd (+{log.delayMinutes} min)
                          </span>
                        )}
                        {log.status === 'early' && (
                          <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-bold">
                            Te vroeg ({log.delayMinutes} min)
                          </span>
                        )}
                        {log.status === 'ontime' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                            Op tijd (0 min)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
