import React, { useState, useMemo } from 'react';
import { ConnectionLogEntry, TransferDirection } from '../types/train';
import {
  aggregateConnectionStats,
  filterConnectionLogsByPeriod,
  exportRawConnectionsToCSV,
} from '../utils/aansluitingen';
import {
  X,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Search,
  Train,
  Bus,
  RefreshCw,
  Info,
  Calendar,
  ArrowRightLeft,
  ArrowRight,
} from 'lucide-react';

interface AansluitingenDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ConnectionLogEntry[];
  onTriggerLiveScan?: () => void;
  isScanning?: boolean;
}

export const AansluitingenDashboard: React.FC<AansluitingenDashboardProps> = ({
  isOpen,
  onClose,
  logs,
  onTriggerLiveScan,
  isScanning = false,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [directionFilter, setDirectionFilter] = useState<'all' | TransferDirection>('all');
  const [trainTypeFilter, setTrainTypeFilter] = useState<'all' | 'Intercity' | 'Sprinter'>('all');
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'gehaald' | 'gemist'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Period filtering (Day / Week / Month / All)
  const periodFilteredLogs = useMemo(() => {
    return filterConnectionLogsByPeriod(logs, periodFilter);
  }, [logs, periodFilter]);

  // 2. High-level KPI summary based on period
  const periodSummary = useMemo(() => {
    return aggregateConnectionStats(periodFilteredLogs);
  }, [periodFilteredLogs]);

  // 3. Multi-dimensional filtering for detailed table and line table
  const finalFilteredLogs = useMemo(() => {
    return periodFilteredLogs.filter((log) => {
      const dir: TransferDirection = log.direction || 'bus_naar_trein';
      if (directionFilter !== 'all' && dir !== directionFilter) return false;
      if (trainTypeFilter !== 'all' && log.trainType !== trainTypeFilter) return false;
      if (selectedLine !== 'all' && log.busLine !== selectedLine) return false;
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLine = log.busLine.toLowerCase().includes(q);
        const matchesDest = (log.busDestination || '').toLowerCase().includes(q);
        const matchesTrain =
          log.trainNumber.toLowerCase().includes(q) ||
          (log.trainDestination || '').toLowerCase().includes(q) ||
          log.trainType.toLowerCase().includes(q);
        const matchesOperator = (log.busOperator || '').toLowerCase().includes(q);
        const matchesOrigin = (log.originVehicle || '').toLowerCase().includes(q);
        const matchesConnecting = (log.connectingVehicle || '').toLowerCase().includes(q);
        if (
          !matchesLine &&
          !matchesDest &&
          !matchesTrain &&
          !matchesOperator &&
          !matchesOrigin &&
          !matchesConnecting
        ) {
          return false;
        }
      }

      return true;
    });
  }, [periodFilteredLogs, directionFilter, trainTypeFilter, selectedLine, statusFilter, searchQuery]);

  // Unique bus lines present in logs
  const availableLines = useMemo(() => {
    const lines = new Set<string>();
    logs.forEach((l) => {
      if (l.busLine) lines.add(l.busLine);
    });
    return Array.from(lines).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [logs]);

  // CSV download handler
  const handleDownloadCSV = () => {
    const csvContent = exportRawConnectionsToCSV(finalFilteredLogs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `station_steenwijk_aansluitingen_${directionFilter}_${periodFilter}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="aansluitingen-modal-title"
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 text-[var(--text-main)] font-sans tabular-nums select-none"
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border-focus)] w-full max-w-6xl max-h-[94vh] rounded-[6px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[4px] bg-[var(--bg-main)] border border-[var(--status-blue)] flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4 text-[var(--status-blue)]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="aansluitingen-modal-title"
                  className="text-sm sm:text-base font-bold text-[var(--text-main)] tracking-tight"
                >
                  Overstap- &amp; Aansluitingsanalyse Station Steenwijk
                </h2>
                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded-[3px] bg-[var(--accent-gold)]/15 border border-[var(--accent-gold)] text-[var(--accent-gold)] text-[10px] font-mono font-bold uppercase tracking-wider">
                    Bus ⇄ Trein
                  </span>
                  <span className="px-2 py-0.5 rounded-[3px] bg-[var(--status-blue)]/15 border border-[var(--status-blue)] text-[var(--status-blue)] text-[10px] font-mono font-bold uppercase tracking-wider">
                    IC &amp; Sprinter
                  </span>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Bidirectionele monitoring: zowel <strong>Bus ➔ Trein</strong> als <strong>Trein ➔ Bus</strong> voor <strong>Intercity</strong> en <strong>Sprinter</strong>. Minimale loopoverstap: 3 min. Geplande buffer: 3–15 min.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onTriggerLiveScan && (
              <button
                onClick={onTriggerLiveScan}
                disabled={isScanning}
                className="px-2.5 py-1.5 rounded-[4px] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Voer actuele aansluitingscontrole uit"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[var(--accent-gold)] ${
                    isScanning ? 'animate-spin' : ''
                  }`}
                />
                <span className="hidden sm:inline">Hercirculeer</span>
              </button>
            )}

            <button
              onClick={handleDownloadCSV}
              className="px-2.5 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Exporteer actuele dataset als CSV bestand"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-[4px] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer ml-1"
              aria-label="Sluiten"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-4 py-2.5 bg-[var(--bg-main)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
          {/* Period Selection (Day, Week, Month, All) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)] text-[11px] font-semibold flex items-center gap-1 mr-1">
              <Calendar className="w-3 h-3 text-[var(--accent-gold)]" />
              Periode:
            </span>
            <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-0.5">
              {(
                [
                  { key: 'day', label: 'Vandaag' },
                  { key: 'week', label: 'Deze Week' },
                  { key: 'month', label: 'Deze Maand' },
                  { key: 'all', label: 'Alles' },
                ] as const
              ).map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodFilter(p.key)}
                  className={`px-2.5 py-1 rounded-[3px] text-xs font-semibold transition-colors cursor-pointer ${
                    periodFilter === p.key
                      ? 'bg-[var(--accent-gold)] text-[#060e0a]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Direction, Train Type, Bus Line, Status Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Direction Filter (Bus->Trein vs Trein->Bus) */}
            <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-2 py-1">
              <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--status-blue)]" />
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as any)}
                className="bg-transparent text-xs text-[var(--text-main)] focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#0b1a13]">
                  Alle Richtingen (Bus ⇄ Trein)
                </option>
                <option value="bus_naar_trein" className="bg-[#0b1a13]">
                  Bus ➔ Trein (Aankomende bus)
                </option>
                <option value="trein_naar_bus" className="bg-[#0b1a13]">
                  Trein ➔ Bus (Aankomende trein)
                </option>
              </select>
            </div>

            {/* Train Type Filter (Intercity vs Sprinter) */}
            <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-2 py-1">
              <Train className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <select
                value={trainTypeFilter}
                onChange={(e) => setTrainTypeFilter(e.target.value as any)}
                className="bg-transparent text-xs text-[var(--text-main)] focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#0b1a13]">
                  Alle Treinen (IC &amp; Sprinter)
                </option>
                <option value="Intercity" className="bg-[#0b1a13]">
                  Alleen Intercity (IC)
                </option>
                <option value="Sprinter" className="bg-[#0b1a13]">
                  Alleen Sprinter
                </option>
              </select>
            </div>

            {/* Bus Line Filter */}
            <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-2 py-1">
              <Bus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="bg-transparent text-xs text-[var(--text-main)] focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#0b1a13]">
                  Alle Buslijnen ({availableLines.length})
                </option>
                {availableLines.map((l) => (
                  <option key={l} value={l} className="bg-[#0b1a13]">
                    Lijn {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-xs text-[var(--text-main)] focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#0b1a13]">
                  Alle Statussen
                </option>
                <option value="gehaald" className="bg-[#0b1a13]">
                  Alleen Gehaald
                </option>
                <option value="gemist" className="bg-[#0b1a13]">
                  Alleen Gemist
                </option>
              </select>
            </div>

            {/* Free Search */}
            <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-2 py-1 w-36 sm:w-44">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] mr-1 shrink-0" />
              <input
                type="text"
                placeholder="Zoek lijn/trein..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none w-full"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Section 1: KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Card 1: Totaal Gepland */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Totaal Gepland</span>
                <Clock className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-[var(--text-main)]">
                {periodSummary.totalPlanned}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] mt-1">
                Aansluitingsvenster 3–15 min
              </div>
            </div>

            {/* Card 2: Aansluitingen Gehaald */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Gehaald</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-emerald)]" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-[var(--status-emerald)]">
                {periodSummary.transfersMade}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] mt-1">≥ 3 min overstaptijd</div>
            </div>

            {/* Card 3: Aansluitingen Gemist */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Gemist</span>
                <XCircle className="w-3.5 h-3.5 text-[var(--status-crimson)]" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-[var(--status-crimson)]">
                {periodSummary.transfersMissed}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] mt-1">&lt; 3 min overstaptijd</div>
            </div>

            {/* Card 4: Slagingspercentage */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Slagingspercentage</span>
                <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-[var(--accent-gold-bright)]">
                {periodSummary.successRate}%
              </div>
              <div className="w-full bg-[var(--bg-main)] h-1.5 rounded-[2px] mt-1.5 overflow-hidden">
                <div
                  className="bg-[var(--status-emerald)] h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, periodSummary.successRate))}%` }}
                />
              </div>
            </div>

            {/* Card 5: Gemiddelde Overstaptijd */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] p-3 flex flex-col justify-between col-span-2 md:col-span-1">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Gerealiseerde Marge</span>
                <Info className="w-3.5 h-3.5 text-[var(--status-blue)]" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-[var(--status-blue)]">
                {periodSummary.avgRealizedMarginMin}m
              </div>
              <div className="text-[11px] text-[var(--text-dim)] mt-1">
                Geplande buffer: {periodSummary.avgPlannedBufferMin}m
              </div>
            </div>
          </div>

          {/* Section 1b: Directional & Train Type Comparative Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Box 1: Bus -> Trein */}
            <div
              onClick={() => setDirectionFilter(directionFilter === 'bus_naar_trein' ? 'all' : 'bus_naar_trein')}
              className={`bg-[var(--bg-card)] border rounded-[4px] p-3 transition-colors cursor-pointer ${
                directionFilter === 'bus_naar_trein'
                  ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-focus)]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-main)]">
                  <Bus className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>Bus ➔ Trein</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-[var(--accent-gold)]">
                  {periodSummary.byDirection.bus_naar_trein.rate}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold font-mono text-[var(--text-main)]">
                  {periodSummary.byDirection.bus_naar_trein.made}{' '}
                  <span className="text-xs text-[var(--text-dim)] font-normal">/ {periodSummary.byDirection.bus_naar_trein.total} gehaald</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--status-crimson)]">
                  {periodSummary.byDirection.bus_naar_trein.missed} gemist
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] flex justify-between text-[var(--text-dim)] font-mono">
                <span>IC: {periodSummary.byDirectionAndTrainType.bus_naar_trein.intercity.rate}%</span>
                <span>Sprinter: {periodSummary.byDirectionAndTrainType.bus_naar_trein.sprinter.rate}%</span>
              </div>
            </div>

            {/* Box 2: Trein -> Bus */}
            <div
              onClick={() => setDirectionFilter(directionFilter === 'trein_naar_bus' ? 'all' : 'trein_naar_bus')}
              className={`bg-[var(--bg-card)] border rounded-[4px] p-3 transition-colors cursor-pointer ${
                directionFilter === 'trein_naar_bus'
                  ? 'border-[var(--status-blue)] bg-[var(--status-blue)]/10'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-focus)]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-main)]">
                  <Train className="w-3.5 h-3.5 text-[var(--status-blue)]" />
                  <span>Trein ➔ Bus</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-[var(--status-blue)]">
                  {periodSummary.byDirection.trein_naar_bus.rate}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold font-mono text-[var(--text-main)]">
                  {periodSummary.byDirection.trein_naar_bus.made}{' '}
                  <span className="text-xs text-[var(--text-dim)] font-normal">/ {periodSummary.byDirection.trein_naar_bus.total} gehaald</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--status-crimson)]">
                  {periodSummary.byDirection.trein_naar_bus.missed} gemist
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] flex justify-between text-[var(--text-dim)] font-mono">
                <span>IC: {periodSummary.byDirectionAndTrainType.trein_naar_bus.intercity.rate}%</span>
                <span>Sprinter: {periodSummary.byDirectionAndTrainType.trein_naar_bus.sprinter.rate}%</span>
              </div>
            </div>

            {/* Box 3: Intercity (IC) */}
            <div
              onClick={() => setTrainTypeFilter(trainTypeFilter === 'Intercity' ? 'all' : 'Intercity')}
              className={`bg-[var(--bg-card)] border rounded-[4px] p-3 transition-colors cursor-pointer ${
                trainTypeFilter === 'Intercity'
                  ? 'border-[#eab308] bg-[#eab308]/10'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-focus)]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-main)]">
                  <span className="w-2 h-2 rounded-full bg-[#eab308]" />
                  <span>Intercity (IC)</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-[#eab308]">
                  {periodSummary.byTrainType.intercity.rate}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold font-mono text-[var(--text-main)]">
                  {periodSummary.byTrainType.intercity.made}{' '}
                  <span className="text-xs text-[var(--text-dim)] font-normal">/ {periodSummary.byTrainType.intercity.total} gehaald</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--status-crimson)]">
                  {periodSummary.byTrainType.intercity.missed} gemist
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] flex justify-between text-[var(--text-dim)] font-mono">
                <span>Bus➔IC: {periodSummary.byDirectionAndTrainType.bus_naar_trein.intercity.rate}%</span>
                <span>IC➔Bus: {periodSummary.byDirectionAndTrainType.trein_naar_bus.intercity.rate}%</span>
              </div>
            </div>

            {/* Box 4: Sprinter */}
            <div
              onClick={() => setTrainTypeFilter(trainTypeFilter === 'Sprinter' ? 'all' : 'Sprinter')}
              className={`bg-[var(--bg-card)] border rounded-[4px] p-3 transition-colors cursor-pointer ${
                trainTypeFilter === 'Sprinter'
                  ? 'border-[#0284c7] bg-[#0284c7]/10'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-focus)]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-main)]">
                  <span className="w-2 h-2 rounded-full bg-[#0284c7]" />
                  <span>Sprinter</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-[#0284c7]">
                  {periodSummary.byTrainType.sprinter.rate}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold font-mono text-[var(--text-main)]">
                  {periodSummary.byTrainType.sprinter.made}{' '}
                  <span className="text-xs text-[var(--text-dim)] font-normal">/ {periodSummary.byTrainType.sprinter.total} gehaald</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--status-crimson)]">
                  {periodSummary.byTrainType.sprinter.missed} gemist
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] flex justify-between text-[var(--text-dim)] font-mono">
                <span>Bus➔SPR: {periodSummary.byDirectionAndTrainType.bus_naar_trein.sprinter.rate}%</span>
                <span>SPR➔Bus: {periodSummary.byDirectionAndTrainType.trein_naar_bus.sprinter.rate}%</span>
              </div>
            </div>
          </div>

          {/* Section 2: Overzicht per Buslijn met Richting & Treintype Uitsplitsing */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4 text-[var(--accent-gold)]" />
                <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">
                  Aansluitingsstatistieken per Buslijn ({periodFilter.toUpperCase()})
                </h3>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                Uitsplitsing naar <strong>Bus➔Trein</strong>, <strong>Trein➔Bus</strong>, <strong>Intercity</strong> en <strong>Sprinter</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-main)]/60 text-[var(--text-muted)] font-semibold text-[11px]">
                    <th className="py-2 px-3">Lijn</th>
                    <th className="py-2 px-3">Vervoerder</th>
                    <th className="py-2 px-3 text-right">Gepland</th>
                    <th className="py-2 px-3 text-right text-[var(--status-emerald)]">Gehaald</th>
                    <th className="py-2 px-3 text-right text-[var(--status-crimson)]">Gemist</th>
                    <th className="py-2 px-3 text-right">Totaal Slaging</th>
                    <th className="py-2 px-3 text-right text-[var(--accent-gold)]">Bus ➔ Trein</th>
                    <th className="py-2 px-3 text-right text-[var(--status-blue)]">Trein ➔ Bus</th>
                    <th className="py-2 px-3 text-right text-[#eab308]">Intercity</th>
                    <th className="py-2 px-3 text-right text-[#0284c7]">Sprinter</th>
                    <th className="py-2 px-3 w-32">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]/60">
                  {Object.values(periodSummary.byLine).length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-4 text-center text-xs text-[var(--text-muted)]">
                        Geen aansluitingen geregistreerd voor deze periode.
                      </td>
                    </tr>
                  ) : (
                    Object.values(periodSummary.byLine).map((item) => {
                      const isHigh = item.rate >= 90;
                      const isMedium = item.rate >= 75 && item.rate < 90;
                      const rateColor = isHigh
                        ? 'text-[var(--status-emerald)]'
                        : isMedium
                        ? 'text-[var(--accent-gold-bright)]'
                        : 'text-[var(--status-crimson)]';

                      return (
                        <tr
                          key={item.line}
                          onClick={() => setSelectedLine(item.line === selectedLine ? 'all' : item.line)}
                          className={`hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors ${
                            selectedLine === item.line ? 'bg-[var(--bg-elevated)]' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-bold font-mono text-[var(--accent-gold)]">
                            Lijn {item.line}
                          </td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">{item.operator}</td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--text-main)]">
                            {item.total}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[var(--status-emerald)]">
                            {item.made}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[var(--status-crimson)]">
                            {item.missed}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${rateColor}`}>
                            {item.rate}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--accent-gold)]">
                            {item.busToTrain.rate}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--status-blue)]">
                            {item.trainToBus.rate}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[#eab308]">
                            {item.intercity.rate}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[#0284c7]">
                            {item.sprinter.rate}%
                          </td>
                          <td className="py-2 px-3">
                            <div className="w-full bg-[var(--bg-main)] h-2 rounded-[2px] overflow-hidden flex">
                              <div
                                className="bg-[var(--status-emerald)] h-full"
                                style={{ width: `${item.rate}%` }}
                              />
                              <div
                                className="bg-[var(--status-crimson)] h-full"
                                style={{ width: `${100 - item.rate}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Detailed Individual Connection Logs */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Train className="w-4 h-4 text-[var(--status-blue)]" />
                <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">
                  Gedetailleerd Logboek Aansluitingen ({finalFilteredLogs.length} passages getoond)
                </h3>
              </div>
              <span className="text-[11px] text-[var(--text-dim)]">
                Inclusief dynamische vertragingcompensatie (vertraagde trein redt bus of vice versa)
              </span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--bg-main)]">
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-semibold text-[11px]">
                    <th className="py-2 px-3">Datum &amp; Tijd</th>
                    <th className="py-2 px-3">Overstap Richting</th>
                    <th className="py-2 px-3">Treintype &amp; Nummer</th>
                    <th className="py-2 px-3">Eerste Deel (Aankomst)</th>
                    <th className="py-2 px-3">Aansluitend (Vertrek)</th>
                    <th className="py-2 px-3 text-right">Gepland</th>
                    <th className="py-2 px-3 text-right">Gerealiseerd</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3">Toelichting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]/60">
                  {finalFilteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-[var(--text-muted)]">
                        Geen ritten gevonden die voldoen aan de geselecteerde filters.
                      </td>
                    </tr>
                  ) : (
                    finalFilteredLogs.map((log) => {
                      const isMade = log.status === 'gehaald';
                      const isBusToTrain = (log.direction || 'bus_naar_trein') === 'bus_naar_trein';
                      const isSprinter = (log.trainType || '').toLowerCase().includes('sprinter');

                      const originText = isBusToTrain
                        ? `Bus ${log.busLine} (${log.busOperator})`
                        : `${log.trainType} ${log.trainNumber}`;
                      const originPlanned = isBusToTrain ? (log.busPlannedArrival || log.plannedOriginArrival) : (log.trainPlannedArrival || log.plannedOriginArrival);
                      const originActual = isBusToTrain ? (log.busActualArrival || log.actualOriginArrival) : (log.trainActualArrival || log.actualOriginArrival);
                      const originDelay = isBusToTrain ? log.busDelayMinutes : log.trainDelayMinutes;

                      const connectingText = isBusToTrain
                        ? `${log.trainType} ${log.trainNumber} (${log.trainPlatform || 'Spoor 1/2'})`
                        : `Bus ${log.busLine} (${log.busOperator})`;
                      const connectingPlanned = isBusToTrain ? (log.trainPlannedDeparture || log.plannedConnectingDeparture) : (log.busPlannedDeparture || log.plannedConnectingDeparture);
                      const connectingActual = isBusToTrain ? (log.trainActualDeparture || log.actualConnectingDeparture) : (log.busActualDeparture || log.actualConnectingDeparture);
                      const connectingDelay = isBusToTrain ? log.trainDelayMinutes : log.busDelayMinutes;

                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-[var(--bg-card-hover)] transition-colors"
                        >
                          {/* Datum & Tijd */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="font-mono text-[var(--text-main)]">{log.date}</div>
                            <div className="text-[10px] text-[var(--text-dim)]">
                              {log.timestamp.slice(11, 16)}
                            </div>
                          </td>

                          {/* Richting Badge */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-mono font-bold border ${
                                isBusToTrain
                                  ? 'bg-[var(--accent-gold)]/15 border-[var(--accent-gold)] text-[var(--accent-gold)]'
                                  : 'bg-[var(--status-blue)]/15 border-[var(--status-blue)] text-[var(--status-blue)]'
                              }`}
                            >
                              {isBusToTrain ? (
                                <>
                                  <Bus className="w-3 h-3" />
                                  <span>Bus ➔ Trein</span>
                                </>
                              ) : (
                                <>
                                  <Train className="w-3 h-3" />
                                  <span>Trein ➔ Bus</span>
                                </>
                              )}
                            </span>
                          </td>

                          {/* Trein Soort & Nummer */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-[2px] leading-tight ${
                                  isSprinter
                                    ? 'bg-[#0284c7] text-[#f5f6f4]'
                                    : 'bg-[#eab308] text-[#060e0a]'
                                }`}
                              >
                                {isSprinter ? 'Sprinter' : 'IC'}
                              </span>
                              <span className="font-mono text-[var(--text-main)] font-semibold">
                                #{log.trainNumber}
                              </span>
                            </div>
                            <div className="text-[10px] text-[var(--text-dim)] truncate max-w-[130px] mt-0.5">
                              {log.trainDestination ? `→ ${log.trainDestination}` : log.trainPlatform}
                            </div>
                          </td>

                          {/* Eerste Deel (Aankomst) */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="font-bold text-[var(--text-main)]">{originText}</div>
                            <div className="text-[10px] font-mono text-[var(--text-dim)]">
                              {originActual} (gepl. {originPlanned})
                              {originDelay !== 0 && (
                                <span
                                  className={`ml-1 font-bold ${
                                    originDelay > 0
                                      ? 'text-[var(--status-crimson)]'
                                      : 'text-[var(--status-blue)]'
                                  }`}
                                >
                                  ({originDelay > 0 ? `+${originDelay}m` : `${originDelay}m`})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Tweede Deel (Aansluitend Vertrek) */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="font-bold text-[var(--text-main)]">{connectingText}</div>
                            <div className="text-[10px] font-mono text-[var(--text-dim)]">
                              {connectingActual} (gepl. {connectingPlanned})
                              {connectingDelay !== 0 && (
                                <span
                                  className={`ml-1 font-bold ${
                                    connectingDelay > 0
                                      ? 'text-[var(--status-emerald)]'
                                      : 'text-[var(--text-dim)]'
                                  }`}
                                >
                                  ({connectingDelay > 0 ? `+${connectingDelay}m` : `${connectingDelay}m`})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Geplande overstaptijd */}
                          <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {log.plannedTransferMinutes} min
                          </td>

                          {/* Gerealiseerde overstaptijd */}
                          <td
                            className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                              isMade
                                ? 'text-[var(--status-emerald)]'
                                : 'text-[var(--status-crimson)]'
                            }`}
                          >
                            {log.realizedTransferMinutes} min
                          </td>

                          {/* Status Badge */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-bold border ${
                                isMade
                                  ? 'bg-[var(--status-emerald)]/15 border-[var(--status-emerald)] text-[var(--status-emerald)]'
                                  : 'bg-[var(--status-crimson)]/15 border-[var(--status-crimson)] text-[var(--status-crimson)]'
                              }`}
                            >
                              {isMade ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Gehaald</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  <span>Gemist</span>
                                </>
                              )}
                            </span>
                          </td>

                          {/* Toelichting */}
                          <td className="py-2 px-3 text-[11px] text-[var(--text-muted)] max-w-[280px]">
                            {log.notes || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
