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
    <div className="fixed inset-0 z-[600] bg-[#060e0a]/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden tabular-nums">
      <div className="bg-[var(--bg-card)] w-full max-w-6xl h-[92vh] rounded-[6px] border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden text-[var(--text-main)]">
        {/* Header */}
        <div className="bg-[var(--bg-elevated)] text-[var(--text-main)] px-5 py-4 flex items-center justify-between border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[4px] bg-[var(--accent-gold)] text-[#060e0a] flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-main)]">
                  OV Stiptheid, Vertraging &amp; Uitval Logboek — Gemeente Steenwijkerland
                </h2>
                <span className="text-xs font-mono text-[var(--status-emerald)] tabular-nums">
                  · Actieve Logging vanaf {todayInfo.dateStr}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Analyse per bushalte en per lijnnummer op maand- en weekbasis · Permanent opgeslagen &amp; exporteerbaar als .CSV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCloudSync && (
              <button
                onClick={onCloudSync}
                disabled={isCloudSyncing}
                className="px-3 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
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
                className="p-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs transition-colors cursor-pointer"
                title="Uitloggen bij Firebase"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onTriggerLiveScan}
              disabled={isScanning}
              className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Log direct actuele DRGL ritten"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[var(--accent-gold)]' : ''}`} />
              <span className="hidden sm:inline">Nu Loggen (DRGL)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar (Maand / Weeknummer / Lijn / Zoek + CSV Export) */}
        <div className="bg-[var(--bg-main)] border-b border-[var(--border-subtle)] px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Type Selector */}
            <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-0.5 text-xs font-semibold">
              <button
                onClick={() => setPeriodType('all')}
                className={`px-2.5 py-1 rounded-[3px] transition-colors cursor-pointer tabular-nums ${
                  periodType === 'all'
                    ? 'bg-[var(--accent-gold)] text-[#060e0a]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                Vanaf Vandaag ({todayInfo.dateStr})
              </button>
              <button
                onClick={() => setPeriodType('month')}
                className={`px-2.5 py-1 rounded-[3px] transition-colors cursor-pointer ${
                  periodType === 'month'
                    ? 'bg-[var(--accent-gold)] text-[#060e0a]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                Per Maand
              </button>
              <button
                onClick={() => setPeriodType('week')}
                className={`px-2.5 py-1 rounded-[3px] transition-colors cursor-pointer ${
                  periodType === 'week'
                    ? 'bg-[var(--accent-gold)] text-[#060e0a]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                Per Weeknummer
              </button>
            </div>

            {/* Month Dropdown */}
            {periodType === 'month' && (
              <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-2.5 py-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span className="text-[var(--text-muted)] font-medium">Maand:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="font-bold text-[var(--text-main)] bg-transparent focus:outline-none tabular-nums"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m} className="bg-[#0b1a13] text-[#f5f6f4]">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Week Dropdown */}
            {periodType === 'week' && (
              <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-2.5 py-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span className="text-[var(--text-muted)] font-medium">Week:</span>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="font-bold text-[var(--text-main)] bg-transparent focus:outline-none tabular-nums"
                >
                  {availableWeeks.map((w) => (
                    <option key={w} value={w} className="bg-[#0b1a13] text-[#f5f6f4]">
                      Week {w.split('-W')[1]} ({w.split('-W')[0]})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Line Filter */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-2.5 py-1 text-xs">
              <Bus className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span className="text-[var(--text-muted)] font-medium">Lijn:</span>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="font-bold text-[var(--text-main)] bg-transparent focus:outline-none tabular-nums"
              >
                <option value="ALL" className="bg-[#0b1a13] text-[#f5f6f4]">Alle lijnen ({availableLines.length})</option>
                {availableLines.map((l) => (
                  <option key={l} value={l} className="bg-[#0b1a13] text-[#f5f6f4]">
                    Lijn {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Stop / Town */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[var(--text-dim)] absolute left-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek plaats of haltenaam..."
                className="pl-8 pr-6 py-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] text-xs text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-focus)] w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs"
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
              className="px-3 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
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
              className="px-3 py-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>Export Lijnen (.csv)</span>
            </button>

            <button
              onClick={() =>
                triggerCsvDownload(
                  exportRawLogsToCSV(filteredRawLogs),
                  `steenwijkerland_ruwe_logdata_${periodLabel}.csv`
                )
              }
              className="px-2.5 py-1.5 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Exporteer alle individuele gelogde rit-passages als CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span className="hidden md:inline">Alle Logregels (.csv)</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 px-5 py-3 bg-[var(--bg-card)] border-b border-[var(--border-subtle)] shrink-0 text-xs tabular-nums">
          <div className="bg-[var(--bg-main)] p-3 rounded-[4px] border border-[var(--border-subtle)]">
            <div className="text-[var(--text-muted)] font-medium">Gelogde Halte-passages</div>
            <div className="text-lg font-extrabold text-[var(--text-main)] font-mono mt-0.5 tabular-nums">
              {summary.total}
            </div>
          </div>

          <div className="bg-[var(--bg-main)] p-3 rounded-[4px] border border-[var(--border-subtle)]">
            <div className="text-[var(--status-crimson)] font-semibold flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5" /> Uitgevallen Ritten
            </div>
            <div className="text-lg font-extrabold text-[var(--status-crimson)] font-mono mt-0.5 tabular-nums">
              {summary.cancelledCount}
            </div>
          </div>

          <div className="bg-[var(--bg-main)] p-3 rounded-[4px] border border-[var(--border-subtle)]">
            <div className="text-[var(--accent-gold)] font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Gem. Vertraging (Te laat)
            </div>
            <div className="text-lg font-extrabold text-[var(--accent-gold-bright)] font-mono mt-0.5 tabular-nums">
              +{summary.avgDelay} min{' '}
              <span className="text-[11px] font-normal text-[var(--text-muted)]">({summary.delayedCount} ritten)</span>
            </div>
          </div>

          <div className="bg-[var(--bg-main)] p-3 rounded-[4px] border border-[var(--border-subtle)]">
            <div className="text-[var(--status-blue)] font-semibold flex items-center gap-1">
              <FastForward className="w-3.5 h-3.5" /> Te Vroeg Gepasseerd
            </div>
            <div className="text-lg font-extrabold text-[var(--status-blue)] font-mono mt-0.5 tabular-nums">
              {summary.earlyCount} ritten{' '}
              <span className="text-[11px] font-normal text-[var(--text-muted)]">(gem. -{summary.avgEarly} min)</span>
            </div>
          </div>

          <div className="bg-[var(--bg-main)] p-3 rounded-[4px] border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
            <div className="text-[var(--status-emerald)] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Stipt Op Tijd
            </div>
            <div className="text-lg font-extrabold text-[var(--status-emerald)] font-mono mt-0.5 tabular-nums">
              {summary.onTimeCount} ritten
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center gap-2 shrink-0 tabular-nums">
          <button
            onClick={() => setActiveTab('stops')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'stops'
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Per Bushalte ({stopStats.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('lines')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'lines'
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Bus className="w-3.5 h-3.5" />
            <span>Per Lijnnummer ({lineStats.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'raw'
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Individuele Logregels ({filteredRawLogs.length})</span>
          </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-4 bg-[var(--bg-main)]">
          {activeTab === 'stops' && (
            <div className="border border-[var(--border-subtle)] rounded-[5px] overflow-hidden bg-[var(--bg-card)]">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="bg-[var(--bg-elevated)] text-[var(--text-muted)] border-b border-[var(--border-subtle)] font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Plaats</th>
                    <th className="py-2.5 px-3">Haltenaam</th>
                    <th className="py-2.5 px-3">Lijnen</th>
                    <th className="py-2.5 px-3 text-right">Gelogde Ritten</th>
                    <th className="py-2.5 px-3 text-right text-[var(--status-crimson)]">Uitgevallen Ritten</th>
                    <th className="py-2.5 px-3 text-right text-[var(--accent-gold-bright)]">
                      Vertraagde Ritten &amp; Gem. Vertraging
                    </th>
                    <th className="py-2.5 px-3 text-right text-[var(--status-blue)]">
                      Te Vroeg Gepasseerd &amp; Gem. Minuten
                    </th>
                    <th className="py-2.5 px-3 text-right text-[var(--status-emerald)]">Op Tijd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {stopStats.map((s) => (
                    <tr key={`${s.town}-${s.stopName}`} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[var(--text-main)]">{s.town}</td>
                      <td className="py-2.5 px-3 font-semibold text-[var(--accent-gold-bright)]">{s.stopName}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-muted)]">
                        {s.lines.join(' · ')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--text-main)] tabular-nums">
                        {s.totalRecordedTrips}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <span
                          className={
                            s.cancelledCount > 0
                              ? 'text-[var(--status-crimson)] font-bold'
                              : 'text-[var(--text-dim)]'
                          }
                        >
                          {s.cancelledCount} ({s.cancelledPercent}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <div className="font-bold text-[var(--accent-gold-bright)]">
                          +{s.avgDelayWhenDelayedMin} min{' '}
                          <span className="text-[10px] font-normal text-[var(--text-dim)]">
                            ({s.delayedCount}x te laat)
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)]">
                          Alle ritten: +{s.avgDelayAllOperatedMin} min
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <div className="font-bold text-[var(--status-blue)]">
                          {s.earlyCount}x te vroeg
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)]">
                          Gem. -{s.avgEarlyMinutes} min te vroeg
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--status-emerald)] font-semibold tabular-nums">
                        {s.onTimeCount} ({s.onTimePercent}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'lines' && (
            <div className="border border-[var(--border-subtle)] rounded-[5px] overflow-hidden bg-[var(--bg-card)]">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="bg-[var(--bg-elevated)] text-[var(--text-muted)] border-b border-[var(--border-subtle)] font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Lijn</th>
                    <th className="py-2.5 px-3">Vervoerder</th>
                    <th className="py-2.5 px-3">Traject in Steenwijkerland</th>
                    <th className="py-2.5 px-3 text-right">Gelogde Passages</th>
                    <th className="py-2.5 px-3 text-right text-[var(--status-crimson)]">Uitgevallen Ritten</th>
                    <th className="py-2.5 px-3 text-right text-[var(--accent-gold-bright)]">
                      Vertraagd &amp; Gem. Vertraging
                    </th>
                    <th className="py-2.5 px-3 text-right text-[var(--status-blue)]">
                      Te Vroeg Gepasseerd &amp; Gem. Minuten
                    </th>
                    <th className="py-2.5 px-3 text-right text-[var(--status-emerald)]">Op Tijd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {lineStats.map((l) => (
                    <tr key={l.line} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-[4px] bg-[var(--bg-elevated)] border border-[var(--border-focus)] text-[var(--accent-gold-bright)] font-mono font-bold text-xs tabular-nums">
                          Lijn {l.line}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-main)]">{l.operator}</td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)]">{l.routeSummary}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--text-main)] tabular-nums">
                        {l.totalRecordedTrips}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <span
                          className={
                            l.cancelledCount > 0
                              ? 'text-[var(--status-crimson)] font-bold'
                              : 'text-[var(--text-dim)]'
                          }
                        >
                          {l.cancelledCount} ({l.cancelledPercent}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <div className="font-bold text-[var(--accent-gold-bright)]">
                          +{l.avgDelayWhenDelayedMin} min{' '}
                          <span className="text-[10px] font-normal text-[var(--text-dim)]">
                            ({l.delayedCount}x)
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)]">
                          Alle ritten: +{l.avgDelayAllOperatedMin} min
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <div className="font-bold text-[var(--status-blue)]">{l.earlyCount}x te vroeg</div>
                        <div className="text-[10px] text-[var(--text-dim)]">
                          Gem. -{l.avgEarlyMinutes} min te vroeg
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--status-emerald)] font-semibold tabular-nums">
                        {l.onTimeCount} ({l.onTimePercent}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="border border-[var(--border-subtle)] rounded-[5px] overflow-hidden bg-[var(--bg-card)]">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="bg-[var(--bg-elevated)] text-[var(--text-muted)] border-b border-[var(--border-subtle)] font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Datum &amp; Week</th>
                    <th className="py-2.5 px-3">Plaats &amp; Haltenaam</th>
                    <th className="py-2.5 px-3">Lijn &amp; Richting</th>
                    <th className="py-2.5 px-3">Gepland</th>
                    <th className="py-2.5 px-3">Werkelijk</th>
                    <th className="py-2.5 px-3">Status &amp; Afwijking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredRawLogs.slice(0, 250).map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-2 px-3 font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                        <div>{log.date}</div>
                        <div className="text-[10px] text-[var(--text-dim)]">
                          {log.yearWeek} · Maand {log.yearMonth}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-[var(--text-main)]">{log.town}</span> —{' '}
                        <span className="font-semibold text-[var(--accent-gold-bright)]">{log.stopName}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono font-bold text-[var(--accent-gold)] mr-1.5 tabular-nums">
                          Lijn {log.line}
                        </span>
                        <span className="text-[var(--text-muted)]">→ {log.destination}</span>
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-[var(--text-main)] tabular-nums">{log.plannedTime}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-[var(--text-main)] tabular-nums">{log.actualTime}</td>
                      <td className="py-2 px-3 font-mono tabular-nums">
                        {log.status === 'cancelled' && (
                          <span className="text-[var(--status-crimson)] font-bold">
                            Uitgevallen
                          </span>
                        )}
                        {log.status === 'delayed' && (
                          <span className="text-[var(--accent-gold-bright)] font-bold">
                            Vertraagd (+{log.delayMinutes} min)
                          </span>
                        )}
                        {log.status === 'early' && (
                          <span className="text-[var(--status-blue)] font-bold">
                            Te vroeg ({log.delayMinutes} min)
                          </span>
                        )}
                        {log.status === 'ontime' && (
                          <span className="text-[var(--status-emerald)] font-semibold">
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
