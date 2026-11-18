import { DatabaseSync, StatementSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import { STEENWIJKERLAND_STOPS } from '../data/steenwijkerland';
import {
  PunctualityLogEntry,
  StopPunctualityStats,
  LinePunctualityStats,
  StopPopupSummary,
  LINE_DESCRIPTIONS,
  getISOWeekInfo,
} from '../utils/punctuality';
import {
  ConnectionLogEntry,
  ConnectionSummary,
  DirectionStats,
  TransferDirection,
} from '../types/train';
import {
  DeelfietsLocation,
  DeelfietsLogEntry,
  DeelfietsPeriodStats,
} from '../utils/deelfiets';
import {
  OvFietsLocation,
  OvFietsLogEntry,
  OvFietsPeriodStats,
} from '../utils/ovfiets';

export interface PaginatedResult<T> {
  rows: T[];
  totalCount: number;
  filteredTotal: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PunctualityQueryParams {
  periodType?: 'all' | 'month' | 'week';
  yearMonth?: string;
  yearWeek?: string;
  line?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  includeRaw?: boolean;
}

export interface AansluitingenQueryParams {
  period?: 'day' | 'week' | 'month' | 'all';
  direction?: 'all' | TransferDirection;
  trainType?: 'all' | 'Intercity' | 'Sprinter';
  line?: string;
  status?: 'all' | 'gehaald' | 'gemist';
  search?: string;
  page?: number;
  pageSize?: number;
  includeRaw?: boolean;
}

export interface DeelfietsQueryParams {
  day?: string;
  week?: string;
  month?: string;
  mode?: 'day' | 'week' | 'month';
  town?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  includeRaw?: boolean;
}

export interface OvFietsQueryParams {
  day?: string;
  week?: string;
  month?: string;
  page?: number;
  pageSize?: number;
  includeRaw?: boolean;
}

function escapeCsvCellSemicolon(val: string | number | null | undefined): string {
  const s = String(val ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeCsvCellComma(val: string | number | null | undefined): string {
  const s = String(val ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function sanitizeFtsQuery(raw: string): string | null {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/["'*():^]/g, '').trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

function computeDirectionStats(
  total: number,
  made: number,
  sumPlan: number,
  sumReal: number
): DirectionStats {
  const missed = total - made;
  const rate = total > 0 ? Number(((made / total) * 100).toFixed(1)) : 100;
  const avgPlannedBufferMin = total > 0 ? Number((sumPlan / total).toFixed(1)) : 0;
  const avgRealizedMarginMin = total > 0 ? Number((sumReal / total).toFixed(1)) : 0;
  return { total, made, missed, rate, avgPlannedBufferMin, avgRealizedMarginMin };
}

function normalizeConnectionEntry(raw: ConnectionLogEntry): ConnectionLogEntry {
  const dir: TransferDirection = raw.direction || 'bus_naar_trein';
  const trainType: 'Intercity' | 'Sprinter' =
    raw.trainType === 'Sprinter' ? 'Sprinter' : 'Intercity';
  return {
    ...raw,
    direction: dir,
    trainType,
    busLine: String(raw.busLine || ''),
    busOperator: String(raw.busOperator || 'OV'),
    busDestination: String(raw.busDestination || ''),
    busDelayMinutes: Number(raw.busDelayMinutes || 0),
    trainNumber: String(raw.trainNumber || ''),
    trainDestination: String(raw.trainDestination || ''),
    trainPlatform: String(raw.trainPlatform || ''),
    trainDelayMinutes: Number(raw.trainDelayMinutes || 0),
    originVehicle:
      raw.originVehicle ||
      (dir === 'bus_naar_trein' ? `Bus ${raw.busLine}` : `${trainType} ${raw.trainNumber}`),
    connectingVehicle:
      raw.connectingVehicle ||
      (dir === 'bus_naar_trein'
        ? `${trainType} ${raw.trainNumber}`
        : `Bus ${raw.busLine}`),
    plannedOriginArrival:
      raw.plannedOriginArrival ||
      (dir === 'bus_naar_trein'
        ? raw.busPlannedArrival || '00:00'
        : raw.trainPlannedArrival || '00:00'),
    actualOriginArrival:
      raw.actualOriginArrival ||
      (dir === 'bus_naar_trein'
        ? raw.busActualArrival || '00:00'
        : raw.trainActualArrival || '00:00'),
    plannedConnectingDeparture:
      raw.plannedConnectingDeparture ||
      (dir === 'bus_naar_trein'
        ? raw.trainPlannedDeparture || '00:00'
        : raw.busPlannedDeparture || '00:00'),
    actualConnectingDeparture:
      raw.actualConnectingDeparture ||
      (dir === 'bus_naar_trein'
        ? raw.trainActualDeparture || '00:00'
        : raw.busActualDeparture || '00:00'),
    plannedTransferMinutes: Number(raw.plannedTransferMinutes || 0),
    realizedTransferMinutes: Number(raw.realizedTransferMinutes || 0),
    status: raw.status === 'gemist' ? 'gemist' : 'gehaald',
    notes: raw.notes || '',
  };
}

function getPunctualityRollupContrib(
  status: string,
  delayMinutes: number
): {
  cancelled: number;
  delayed: number;
  sumDelayDelayed: number;
  early: number;
  sumEarlyAbs: number;
  ontime: number;
  operated: number;
} {
  if (status === 'cancelled') {
    return {
      cancelled: 1,
      delayed: 0,
      sumDelayDelayed: 0,
      early: 0,
      sumEarlyAbs: 0,
      ontime: 0,
      operated: 0,
    };
  }
  const isDelayed = status === 'delayed' || delayMinutes > 0;
  const isEarly = !isDelayed && (status === 'early' || delayMinutes < 0);
  const isOntime = !isDelayed && !isEarly && status === 'ontime' && delayMinutes === 0;
  return {
    cancelled: 0,
    delayed: isDelayed ? 1 : 0,
    sumDelayDelayed: isDelayed ? Math.max(0, delayMinutes) : 0,
    early: isEarly ? 1 : 0,
    sumEarlyAbs: isEarly ? Math.abs(Math.min(0, delayMinutes)) : 0,
    ontime: isOntime ? 1 : 0,
    operated: 1,
  };
}

export class SteenwijkerlandDB {
  public readonly db: DatabaseSync;
  public readonly dbPath: string;

  // Prepared statements for hot paths
  private stmtGetCount!: StatementSync;
  private stmtIncCount!: StatementSync;

  private stmtSelectPuncById!: StatementSync;
  private stmtInsertPunc!: StatementSync;
  private stmtUpdatePunc!: StatementSync;
  private stmtUpsertPuncDaily!: StatementSync;
  private stmtUpsertPuncTotal!: StatementSync;
  private stmtInsertPuncFts!: StatementSync;
  private stmtDeletePuncFts!: StatementSync;

  private stmtSelectAanslById!: StatementSync;
  private stmtInsertAansl!: StatementSync;
  private stmtUpsertAanslDaily!: StatementSync;
  private stmtUpsertAanslTotal!: StatementSync;
  private stmtInsertAanslFts!: StatementSync;

  private stmtSelectDfById!: StatementSync;
  private stmtInsertDf!: StatementSync;
  private stmtUpdateDf!: StatementSync;
  private stmtUpsertDfDaily!: StatementSync;
  private stmtRecomputeDfPeak!: StatementSync;

  private stmtSelectOvById!: StatementSync;
  private stmtInsertOv!: StatementSync;
  private stmtUpdateOv!: StatementSync;
  private stmtUpsertOvDaily!: StatementSync;
  private stmtRecomputeOvPeak!: StatementSync;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath, { timeout: 5000 });
    this.initPragmasAndSchema();
    this.prepareHotStatements();
  }

  private initPragmasAndSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
      PRAGMA cache_size = -64000;
      PRAGMA mmap_size = 268435456;
      PRAGMA foreign_keys = OFF;

      CREATE TABLE IF NOT EXISTS meta_counts (
        table_name TEXT PRIMARY KEY,
        row_count INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO meta_counts (table_name, row_count) VALUES
        ('punctuality_logs', 0),
        ('aansluitingen_logs', 0),
        ('deelfiets_logs', 0),
        ('ovfiets_logs', 0);

      -- 1. Punctuality Logs
      CREATE TABLE IF NOT EXISTS punctuality_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        date TEXT NOT NULL,
        year_month TEXT NOT NULL,
        iso_year INTEGER NOT NULL,
        iso_week INTEGER NOT NULL,
        year_week TEXT NOT NULL,
        stop_id TEXT NOT NULL,
        stop_code TEXT NOT NULL,
        stop_name TEXT NOT NULL,
        town TEXT NOT NULL,
        line TEXT NOT NULL,
        operator TEXT NOT NULL,
        destination TEXT NOT NULL,
        journey_id TEXT NOT NULL,
        planned_time TEXT NOT NULL,
        actual_time TEXT NOT NULL,
        delay_minutes REAL NOT NULL,
        status TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_punc_ts_id ON punctuality_logs (timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_punc_month_ts ON punctuality_logs (year_month, timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_punc_week_ts ON punctuality_logs (year_week, timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_punc_line_ts ON punctuality_logs (line, timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_punc_month_line_ts ON punctuality_logs (year_month, line, timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_punc_week_line_ts ON punctuality_logs (year_week, line, timestamp DESC, id DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS punctuality_fts USING fts5(
        town, stop_name, line, destination, operator,
        content='punctuality_logs',
        content_rowid='rowid',
        tokenize='unicode61'
      );

      CREATE TABLE IF NOT EXISTS punctuality_daily_rollups (
        date TEXT NOT NULL,
        year_month TEXT NOT NULL,
        year_week TEXT NOT NULL,
        town TEXT NOT NULL,
        stop_name TEXT NOT NULL,
        line TEXT NOT NULL,
        operator TEXT NOT NULL,
        total_count INTEGER NOT NULL DEFAULT 0,
        cancelled_count INTEGER NOT NULL DEFAULT 0,
        delayed_count INTEGER NOT NULL DEFAULT 0,
        sum_delay_delayed REAL NOT NULL DEFAULT 0,
        early_count INTEGER NOT NULL DEFAULT 0,
        sum_early_abs REAL NOT NULL DEFAULT 0,
        ontime_count INTEGER NOT NULL DEFAULT 0,
        operated_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, town, stop_name, line)
      );
      CREATE INDEX IF NOT EXISTS idx_punc_rollup_month ON punctuality_daily_rollups (year_month);
      CREATE INDEX IF NOT EXISTS idx_punc_rollup_week ON punctuality_daily_rollups (year_week);

      CREATE TABLE IF NOT EXISTS punctuality_total_rollups (
        town TEXT NOT NULL,
        stop_name TEXT NOT NULL,
        line TEXT NOT NULL,
        operator TEXT NOT NULL,
        total_count INTEGER NOT NULL DEFAULT 0,
        cancelled_count INTEGER NOT NULL DEFAULT 0,
        delayed_count INTEGER NOT NULL DEFAULT 0,
        sum_delay_delayed REAL NOT NULL DEFAULT 0,
        early_count INTEGER NOT NULL DEFAULT 0,
        sum_early_abs REAL NOT NULL DEFAULT 0,
        ontime_count INTEGER NOT NULL DEFAULT 0,
        operated_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (town, stop_name, line)
      );

      -- 2. Aansluitingen Logs
      CREATE TABLE IF NOT EXISTS aansluitingen_logs (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        date TEXT NOT NULL,
        year_month TEXT NOT NULL,
        iso_year INTEGER NOT NULL,
        iso_week INTEGER NOT NULL,
        year_week TEXT NOT NULL,
        bus_line TEXT NOT NULL,
        bus_operator TEXT NOT NULL,
        bus_destination TEXT NOT NULL,
        bus_planned_arrival TEXT,
        bus_actual_arrival TEXT,
        bus_planned_departure TEXT,
        bus_actual_departure TEXT,
        bus_delay_minutes REAL NOT NULL,
        train_number TEXT NOT NULL,
        train_type TEXT NOT NULL,
        train_destination TEXT NOT NULL,
        train_origin TEXT,
        train_platform TEXT NOT NULL,
        train_planned_departure TEXT,
        train_actual_departure TEXT,
        train_planned_arrival TEXT,
        train_actual_arrival TEXT,
        train_delay_minutes REAL NOT NULL,
        origin_vehicle TEXT NOT NULL,
        connecting_vehicle TEXT NOT NULL,
        planned_origin_arrival TEXT NOT NULL,
        actual_origin_arrival TEXT NOT NULL,
        planned_connecting_departure TEXT NOT NULL,
        actual_connecting_departure TEXT NOT NULL,
        planned_transfer_minutes REAL NOT NULL,
        realized_transfer_minutes REAL NOT NULL,
        status TEXT NOT NULL,
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_aansl_ts_id ON aansluitingen_logs (timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_aansl_date_ts ON aansluitingen_logs (date, timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_aansl_week_ts ON aansluitingen_logs (year_week, timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_aansl_month_ts ON aansluitingen_logs (year_month, timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_aansl_filters ON aansluitingen_logs (direction, train_type, bus_line, status, timestamp DESC, id DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS aansluitingen_fts USING fts5(
        bus_line, bus_operator, bus_destination, train_number, train_type, train_destination, origin_vehicle, connecting_vehicle,
        content='aansluitingen_logs',
        content_rowid='rowid',
        tokenize='unicode61'
      );

      CREATE TABLE IF NOT EXISTS aansluitingen_daily_rollups (
        date TEXT NOT NULL,
        year_month TEXT NOT NULL,
        year_week TEXT NOT NULL,
        direction TEXT NOT NULL,
        train_type TEXT NOT NULL,
        bus_line TEXT NOT NULL,
        bus_operator TEXT NOT NULL,
        total_count INTEGER NOT NULL DEFAULT 0,
        made_count INTEGER NOT NULL DEFAULT 0,
        missed_count INTEGER NOT NULL DEFAULT 0,
        sum_planned_min REAL NOT NULL DEFAULT 0,
        sum_realized_min REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (date, direction, train_type, bus_line)
      );
      CREATE INDEX IF NOT EXISTS idx_aansl_rollup_month ON aansluitingen_daily_rollups (year_month);
      CREATE INDEX IF NOT EXISTS idx_aansl_rollup_week ON aansluitingen_daily_rollups (year_week);

      CREATE TABLE IF NOT EXISTS aansluitingen_total_rollups (
        direction TEXT NOT NULL,
        train_type TEXT NOT NULL,
        bus_line TEXT NOT NULL,
        bus_operator TEXT NOT NULL,
        total_count INTEGER NOT NULL DEFAULT 0,
        made_count INTEGER NOT NULL DEFAULT 0,
        missed_count INTEGER NOT NULL DEFAULT 0,
        sum_planned_min REAL NOT NULL DEFAULT 0,
        sum_realized_min REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (direction, train_type, bus_line)
      );

      -- 3. Deelfiets Logs
      CREATE TABLE IF NOT EXISTS deelfiets_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        date TEXT NOT NULL,
        hour_slot TEXT NOT NULL,
        year_month TEXT NOT NULL,
        iso_year INTEGER NOT NULL,
        iso_week INTEGER NOT NULL,
        year_week TEXT NOT NULL,
        station_id TEXT NOT NULL,
        location_name TEXT NOT NULL,
        town TEXT NOT NULL,
        street_address TEXT NOT NULL,
        electric INTEGER NOT NULL,
        is_cargo_bike INTEGER NOT NULL,
        available_bikes INTEGER NOT NULL,
        rented_bikes INTEGER NOT NULL,
        capacity INTEGER NOT NULL,
        new_rentals INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_df_ts_id ON deelfiets_logs (timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_df_station_date ON deelfiets_logs (station_id, date);
      CREATE INDEX IF NOT EXISTS idx_df_date ON deelfiets_logs (date, timestamp DESC);

      CREATE TABLE IF NOT EXISTS deelfiets_daily_rollups (
        station_id TEXT NOT NULL,
        date TEXT NOT NULL,
        year_month TEXT NOT NULL,
        year_week TEXT NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        sum_available INTEGER NOT NULL DEFAULT 0,
        sum_rented INTEGER NOT NULL DEFAULT 0,
        sum_new_rentals INTEGER NOT NULL DEFAULT 0,
        peak_concurrent_rented INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (station_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_df_rollup_week ON deelfiets_daily_rollups (year_week, station_id);
      CREATE INDEX IF NOT EXISTS idx_df_rollup_month ON deelfiets_daily_rollups (year_month, station_id);

      -- 4. OV-fiets Logs
      CREATE TABLE IF NOT EXISTS ovfiets_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        date TEXT NOT NULL,
        hour TEXT NOT NULL,
        year_month TEXT NOT NULL,
        iso_year INTEGER NOT NULL,
        iso_week INTEGER NOT NULL,
        year_week TEXT NOT NULL,
        station_code TEXT NOT NULL,
        name TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        available INTEGER NOT NULL,
        rented INTEGER NOT NULL,
        new_rentals INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ov_ts_id ON ovfiets_logs (timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_ov_station_date ON ovfiets_logs (station_code, date);

      CREATE TABLE IF NOT EXISTS ovfiets_daily_rollups (
        station_code TEXT NOT NULL,
        date TEXT NOT NULL,
        year_month TEXT NOT NULL,
        year_week TEXT NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        sum_available INTEGER NOT NULL DEFAULT 0,
        sum_rented INTEGER NOT NULL DEFAULT 0,
        sum_new_rentals INTEGER NOT NULL DEFAULT 0,
        peak_concurrent_rented INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (station_code, date)
      );
      CREATE INDEX IF NOT EXISTS idx_ov_rollup_week ON ovfiets_daily_rollups (year_week, station_code);
      CREATE INDEX IF NOT EXISTS idx_ov_rollup_month ON ovfiets_daily_rollups (year_month, station_code);
    `);
  }

  private prepareHotStatements() {
    this.stmtGetCount = this.db.prepare(
      'SELECT row_count FROM meta_counts WHERE table_name = ?'
    );
    this.stmtIncCount = this.db.prepare(
      'UPDATE meta_counts SET row_count = row_count + ? WHERE table_name = ?'
    );

    // Punctuality statements
    this.stmtSelectPuncById = this.db.prepare(
      'SELECT rowid, status, delay_minutes, town, stop_name, line, operator, destination, date, year_month, year_week, planned_time, actual_time FROM punctuality_logs WHERE id = ?'
    );
    this.stmtInsertPunc = this.db.prepare(`
      INSERT INTO punctuality_logs (
        id, timestamp, date, year_month, iso_year, iso_week, year_week,
        stop_id, stop_code, stop_name, town, line, operator, destination,
        journey_id, planned_time, actual_time, delay_minutes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.stmtUpdatePunc = this.db.prepare(`
      UPDATE punctuality_logs
      SET timestamp = ?, planned_time = ?, actual_time = ?, delay_minutes = ?, status = ?, destination = ?, operator = ?
      WHERE id = ?
    `);
    this.stmtUpsertPuncDaily = this.db.prepare(`
      INSERT INTO punctuality_daily_rollups (
        date, year_month, year_week, town, stop_name, line, operator,
        total_count, cancelled_count, delayed_count, sum_delay_delayed, early_count, sum_early_abs, ontime_count, operated_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (date, town, stop_name, line) DO UPDATE SET
        total_count = MAX(0, total_count + excluded.total_count),
        cancelled_count = MAX(0, cancelled_count + excluded.cancelled_count),
        delayed_count = MAX(0, delayed_count + excluded.delayed_count),
        sum_delay_delayed = MAX(0.0, sum_delay_delayed + excluded.sum_delay_delayed),
        early_count = MAX(0, early_count + excluded.early_count),
        sum_early_abs = MAX(0.0, sum_early_abs + excluded.sum_early_abs),
        ontime_count = MAX(0, ontime_count + excluded.ontime_count),
        operated_count = MAX(0, operated_count + excluded.operated_count)
    `);
    this.stmtUpsertPuncTotal = this.db.prepare(`
      INSERT INTO punctuality_total_rollups (
        town, stop_name, line, operator,
        total_count, cancelled_count, delayed_count, sum_delay_delayed, early_count, sum_early_abs, ontime_count, operated_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (town, stop_name, line) DO UPDATE SET
        total_count = MAX(0, total_count + excluded.total_count),
        cancelled_count = MAX(0, cancelled_count + excluded.cancelled_count),
        delayed_count = MAX(0, delayed_count + excluded.delayed_count),
        sum_delay_delayed = MAX(0.0, sum_delay_delayed + excluded.sum_delay_delayed),
        early_count = MAX(0, early_count + excluded.early_count),
        sum_early_abs = MAX(0.0, sum_early_abs + excluded.sum_early_abs),
        ontime_count = MAX(0, ontime_count + excluded.ontime_count),
        operated_count = MAX(0, operated_count + excluded.operated_count)
    `);
    this.stmtInsertPuncFts = this.db.prepare(
      'INSERT INTO punctuality_fts (rowid, town, stop_name, line, destination, operator) VALUES (?, ?, ?, ?, ?, ?)'
    );
    this.stmtDeletePuncFts = this.db.prepare(
      "INSERT INTO punctuality_fts (punctuality_fts, rowid, town, stop_name, line, destination, operator) VALUES ('delete', ?, ?, ?, ?, ?, ?)"
    );

    // Aansluitingen statements
    this.stmtSelectAanslById = this.db.prepare(
      'SELECT id FROM aansluitingen_logs WHERE id = ?'
    );
    this.stmtInsertAansl = this.db.prepare(`
      INSERT INTO aansluitingen_logs (
        id, direction, timestamp, date, year_month, iso_year, iso_week, year_week,
        bus_line, bus_operator, bus_destination, bus_planned_arrival, bus_actual_arrival,
        bus_planned_departure, bus_actual_departure, bus_delay_minutes,
        train_number, train_type, train_destination, train_origin, train_platform,
        train_planned_departure, train_actual_departure, train_planned_arrival, train_actual_arrival,
        train_delay_minutes, origin_vehicle, connecting_vehicle,
        planned_origin_arrival, actual_origin_arrival, planned_connecting_departure, actual_connecting_departure,
        planned_transfer_minutes, realized_transfer_minutes, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.stmtUpsertAanslDaily = this.db.prepare(`
      INSERT INTO aansluitingen_daily_rollups (
        date, year_month, year_week, direction, train_type, bus_line, bus_operator,
        total_count, made_count, missed_count, sum_planned_min, sum_realized_min
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT (date, direction, train_type, bus_line) DO UPDATE SET
        total_count = total_count + 1,
        made_count = made_count + excluded.made_count,
        missed_count = missed_count + excluded.missed_count,
        sum_planned_min = sum_planned_min + excluded.sum_planned_min,
        sum_realized_min = sum_realized_min + excluded.sum_realized_min
    `);
    this.stmtUpsertAanslTotal = this.db.prepare(`
      INSERT INTO aansluitingen_total_rollups (
        direction, train_type, bus_line, bus_operator,
        total_count, made_count, missed_count, sum_planned_min, sum_realized_min
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT (direction, train_type, bus_line) DO UPDATE SET
        total_count = total_count + 1,
        made_count = made_count + excluded.made_count,
        missed_count = missed_count + excluded.missed_count,
        sum_planned_min = sum_planned_min + excluded.sum_planned_min,
        sum_realized_min = sum_realized_min + excluded.sum_realized_min
    `);
    this.stmtInsertAanslFts = this.db.prepare(`
      INSERT INTO aansluitingen_fts (
        rowid, bus_line, bus_operator, bus_destination, train_number, train_type, train_destination, origin_vehicle, connecting_vehicle
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Deelfiets statements
    this.stmtSelectDfById = this.db.prepare(
      'SELECT available_bikes, rented_bikes, new_rentals FROM deelfiets_logs WHERE id = ?'
    );
    this.stmtInsertDf = this.db.prepare(`
      INSERT INTO deelfiets_logs (
        id, timestamp, date, hour_slot, year_month, iso_year, iso_week, year_week,
        station_id, location_name, town, street_address, electric, is_cargo_bike,
        available_bikes, rented_bikes, capacity, new_rentals
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.stmtUpdateDf = this.db.prepare(`
      UPDATE deelfiets_logs
      SET timestamp = ?, available_bikes = ?, rented_bikes = ?, capacity = ?, new_rentals = ?
      WHERE id = ?
    `);
    this.stmtUpsertDfDaily = this.db.prepare(`
      INSERT INTO deelfiets_daily_rollups (
        station_id, date, year_month, year_week,
        sample_count, sum_available, sum_rented, sum_new_rentals, peak_concurrent_rented
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (station_id, date) DO UPDATE SET
        sample_count = MAX(0, sample_count + excluded.sample_count),
        sum_available = MAX(0, sum_available + excluded.sum_available),
        sum_rented = MAX(0, sum_rented + excluded.sum_rented),
        sum_new_rentals = MAX(0, sum_new_rentals + excluded.sum_new_rentals),
        peak_concurrent_rented = MAX(peak_concurrent_rented, excluded.peak_concurrent_rented)
    `);
    this.stmtRecomputeDfPeak = this.db.prepare(`
      UPDATE deelfiets_daily_rollups
      SET peak_concurrent_rented = COALESCE(
        (SELECT MAX(rented_bikes) FROM deelfiets_logs WHERE station_id = ? AND date = ?),
        0
      )
      WHERE station_id = ? AND date = ?
    `);

    // OV-fiets statements
    this.stmtSelectOvById = this.db.prepare(
      'SELECT available, rented, new_rentals FROM ovfiets_logs WHERE id = ?'
    );
    this.stmtInsertOv = this.db.prepare(`
      INSERT INTO ovfiets_logs (
        id, timestamp, date, hour, year_month, iso_year, iso_week, year_week,
        station_code, name, capacity, available, rented, new_rentals
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.stmtUpdateOv = this.db.prepare(`
      UPDATE ovfiets_logs
      SET timestamp = ?, capacity = ?, available = ?, rented = ?, new_rentals = ?
      WHERE id = ?
    `);
    this.stmtUpsertOvDaily = this.db.prepare(`
      INSERT INTO ovfiets_daily_rollups (
        station_code, date, year_month, year_week,
        sample_count, sum_available, sum_rented, sum_new_rentals, peak_concurrent_rented
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (station_code, date) DO UPDATE SET
        sample_count = MAX(0, sample_count + excluded.sample_count),
        sum_available = MAX(0, sum_available + excluded.sum_available),
        sum_rented = MAX(0, sum_rented + excluded.sum_rented),
        sum_new_rentals = MAX(0, sum_new_rentals + excluded.sum_new_rentals),
        peak_concurrent_rented = MAX(peak_concurrent_rented, excluded.peak_concurrent_rented)
    `);
    this.stmtRecomputeOvPeak = this.db.prepare(`
      UPDATE ovfiets_daily_rollups
      SET peak_concurrent_rented = COALESCE(
        (SELECT MAX(rented) FROM ovfiets_logs WHERE station_code = ? AND date = ?),
        0
      )
      WHERE station_code = ? AND date = ?
    `);
  }

  public getTotalCount(tableName: 'punctuality_logs' | 'aansluitingen_logs' | 'deelfiets_logs' | 'ovfiets_logs'): number {
    const row = this.stmtGetCount.get(tableName) as { row_count: number } | undefined;
    return Number(row?.row_count || 0);
  }

  public withTransaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      throw err;
    }
  }

  // -------------------------------------------------------------
  // Batch Upsert Operations (Atomic + Rollup Maintenance)
  // -------------------------------------------------------------
  public upsertPunctualityBatch(entries: PunctualityLogEntry[]): number {
    if (entries.length === 0) return 0;
    return this.withTransaction(() => {
      let insertedCount = 0;
      for (const e of entries) {
        if (!e || !e.id) continue;
        const existing = this.stmtSelectPuncById.get(e.id) as any;
        if (!existing) {
          const info = this.stmtInsertPunc.run(
            e.id,
            e.timestamp,
            e.date,
            e.yearMonth,
            e.isoYear,
            e.isoWeek,
            e.yearWeek,
            e.stopId,
            e.stopCode || '',
            e.stopName,
            e.town,
            e.line,
            e.operator || 'OV',
            e.destination || '',
            e.journeyId || '',
            e.plannedTime,
            e.actualTime,
            Number(e.delayMinutes || 0),
            e.status
          );
          const newRowId = Number(info.lastInsertRowid);
          this.stmtInsertPuncFts.run(
            newRowId,
            e.town,
            e.stopName,
            e.line,
            e.destination || '',
            e.operator || 'OV'
          );
          const c = getPunctualityRollupContrib(e.status, Number(e.delayMinutes || 0));
          this.stmtUpsertPuncDaily.run(
            e.date,
            e.yearMonth,
            e.yearWeek,
            e.town,
            e.stopName,
            e.line,
            e.operator || 'OV',
            1,
            c.cancelled,
            c.delayed,
            c.sumDelayDelayed,
            c.early,
            c.sumEarlyAbs,
            c.ontime,
            c.operated
          );
          this.stmtUpsertPuncTotal.run(
            e.town,
            e.stopName,
            e.line,
            e.operator || 'OV',
            1,
            c.cancelled,
            c.delayed,
            c.sumDelayDelayed,
            c.early,
            c.sumEarlyAbs,
            c.ontime,
            c.operated
          );
          insertedCount++;
        } else {
          const newDelay = Number(e.delayMinutes || 0);
          const changed =
            existing.status !== e.status ||
            Math.abs(Number(existing.delay_minutes) - newDelay) > 0.001 ||
            existing.actual_time !== e.actualTime ||
            existing.planned_time !== e.plannedTime;
          if (!changed) continue;

          const oldC = getPunctualityRollupContrib(existing.status, Number(existing.delay_minutes));
          const newC = getPunctualityRollupContrib(e.status, newDelay);

          this.stmtUpdatePunc.run(
            e.timestamp,
            e.plannedTime,
            e.actualTime,
            newDelay,
            e.status,
            e.destination || existing.destination,
            e.operator || existing.operator,
            e.id
          );

          if (existing.destination !== (e.destination || existing.destination)) {
            this.stmtDeletePuncFts.run(
              existing.rowid,
              existing.town,
              existing.stop_name,
              existing.line,
              existing.destination,
              existing.operator
            );
            this.stmtInsertPuncFts.run(
              existing.rowid,
              existing.town,
              existing.stop_name,
              existing.line,
              e.destination || existing.destination,
              e.operator || existing.operator
            );
          }

          this.stmtUpsertPuncDaily.run(
            existing.date,
            existing.year_month,
            existing.year_week,
            existing.town,
            existing.stop_name,
            existing.line,
            existing.operator,
            0,
            newC.cancelled - oldC.cancelled,
            newC.delayed - oldC.delayed,
            newC.sumDelayDelayed - oldC.sumDelayDelayed,
            newC.early - oldC.early,
            newC.sumEarlyAbs - oldC.sumEarlyAbs,
            newC.ontime - oldC.ontime,
            newC.operated - oldC.operated
          );
          this.stmtUpsertPuncTotal.run(
            existing.town,
            existing.stop_name,
            existing.line,
            existing.operator,
            0,
            newC.cancelled - oldC.cancelled,
            newC.delayed - oldC.delayed,
            newC.sumDelayDelayed - oldC.sumDelayDelayed,
            newC.early - oldC.early,
            newC.sumEarlyAbs - oldC.sumEarlyAbs,
            newC.ontime - oldC.ontime,
            newC.operated - oldC.operated
          );
        }
      }
      if (insertedCount > 0) {
        this.stmtIncCount.run(insertedCount, 'punctuality_logs');
      }
      return insertedCount;
    });
  }

  public hasAansluitingId(id: string): boolean {
    return Boolean(this.stmtSelectAanslById.get(id));
  }

  public hasTrainToBusAansluitingen(): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM aansluitingen_total_rollups WHERE direction = 'trein_naar_bus' LIMIT 1")
      .get();
    return Boolean(row);
  }

  public upsertAansluitingenBatch(entries: ConnectionLogEntry[]): number {
    if (entries.length === 0) return 0;
    return this.withTransaction(() => {
      let insertedCount = 0;
      for (const raw of entries) {
        if (!raw || !raw.id) continue;
        if (this.stmtSelectAanslById.get(raw.id)) continue;

        const e = normalizeConnectionEntry(raw);
        const info = this.stmtInsertAansl.run(
          e.id,
          e.direction,
          e.timestamp,
          e.date,
          e.yearMonth,
          e.isoYear,
          e.isoWeek,
          e.yearWeek,
          e.busLine,
          e.busOperator,
          e.busDestination,
          e.busPlannedArrival ?? null,
          e.busActualArrival ?? null,
          e.busPlannedDeparture ?? null,
          e.busActualDeparture ?? null,
          e.busDelayMinutes,
          e.trainNumber,
          e.trainType,
          e.trainDestination,
          e.trainOrigin ?? null,
          e.trainPlatform,
          e.trainPlannedDeparture ?? null,
          e.trainActualDeparture ?? null,
          e.trainPlannedArrival ?? null,
          e.trainActualArrival ?? null,
          e.trainDelayMinutes,
          e.originVehicle,
          e.connectingVehicle,
          e.plannedOriginArrival,
          e.actualOriginArrival,
          e.plannedConnectingDeparture,
          e.actualConnectingDeparture,
          e.plannedTransferMinutes,
          e.realizedTransferMinutes,
          e.status,
          e.notes ?? null
        );
        const newRowId = Number(info.lastInsertRowid);
        this.stmtInsertAanslFts.run(
          newRowId,
          e.busLine,
          e.busOperator,
          e.busDestination,
          e.trainNumber,
          e.trainType,
          e.trainDestination,
          e.originVehicle,
          e.connectingVehicle
        );

        const isMade = e.status === 'gehaald' ? 1 : 0;
        const isMissed = isMade ? 0 : 1;
        this.stmtUpsertAanslDaily.run(
          e.date,
          e.yearMonth,
          e.yearWeek,
          e.direction,
          e.trainType,
          e.busLine,
          e.busOperator,
          isMade,
          isMissed,
          e.plannedTransferMinutes,
          e.realizedTransferMinutes
        );
        this.stmtUpsertAanslTotal.run(
          e.direction,
          e.trainType,
          e.busLine,
          e.busOperator,
          isMade,
          isMissed,
          e.plannedTransferMinutes,
          e.realizedTransferMinutes
        );
        insertedCount++;
      }
      if (insertedCount > 0) {
        this.stmtIncCount.run(insertedCount, 'aansluitingen_logs');
      }
      return insertedCount;
    });
  }

  public getExistingDeelfietsNewRentals(id: string): number {
    const row = this.stmtSelectDfById.get(id) as { new_rentals: number } | undefined;
    return Number(row?.new_rentals || 0);
  }

  public upsertDeelfietsBatch(entries: DeelfietsLogEntry[]): number {
    if (entries.length === 0) return 0;
    return this.withTransaction(() => {
      let insertedCount = 0;
      const daysToRecomputePeak = new Set<string>();
      for (const e of entries) {
        if (!e || !e.id) continue;
        const existing = this.stmtSelectDfById.get(e.id) as
          | { available_bikes: number; rented_bikes: number; new_rentals: number }
          | undefined;
        if (!existing) {
          this.stmtInsertDf.run(
            e.id,
            e.timestamp,
            e.date,
            e.hourSlot,
            e.yearMonth,
            e.isoYear,
            e.isoWeek,
            e.yearWeek,
            e.stationId,
            e.locationName,
            e.town,
            e.streetAddress || '',
            e.electric ? 1 : 0,
            e.isCargoBike ? 1 : 0,
            e.availableBikes,
            e.rentedBikes,
            e.capacity,
            e.newRentals
          );
          this.stmtUpsertDfDaily.run(
            e.stationId,
            e.date,
            e.yearMonth,
            e.yearWeek,
            1,
            e.availableBikes,
            e.rentedBikes,
            e.newRentals,
            e.rentedBikes
          );
          insertedCount++;
        } else {
          if (
            existing.available_bikes === e.availableBikes &&
            existing.rented_bikes === e.rentedBikes &&
            existing.new_rentals === e.newRentals
          ) {
            continue;
          }
          this.stmtUpdateDf.run(
            e.timestamp,
            e.availableBikes,
            e.rentedBikes,
            e.capacity,
            e.newRentals,
            e.id
          );
          this.stmtUpsertDfDaily.run(
            e.stationId,
            e.date,
            e.yearMonth,
            e.yearWeek,
            0,
            e.availableBikes - existing.available_bikes,
            e.rentedBikes - existing.rented_bikes,
            e.newRentals - existing.new_rentals,
            e.rentedBikes
          );
          if (e.rentedBikes < existing.rented_bikes) {
            daysToRecomputePeak.add(`${e.stationId}::${e.date}`);
          }
        }
      }
      for (const key of daysToRecomputePeak) {
        const [stationId, date] = key.split('::');
        this.stmtRecomputeDfPeak.run(stationId, date, stationId, date);
      }
      if (insertedCount > 0) {
        this.stmtIncCount.run(insertedCount, 'deelfiets_logs');
      }
      return insertedCount;
    });
  }

  public getExistingOvFietsNewRentals(id: string): number {
    const row = this.stmtSelectOvById.get(id) as { new_rentals: number } | undefined;
    return Number(row?.new_rentals || 0);
  }

  public upsertOvfietsBatch(entries: OvFietsLogEntry[]): number {
    if (entries.length === 0) return 0;
    return this.withTransaction(() => {
      let insertedCount = 0;
      const daysToRecomputePeak = new Set<string>();
      for (const e of entries) {
        if (!e || !e.id) continue;
        const existing = this.stmtSelectOvById.get(e.id) as
          | { available: number; rented: number; new_rentals: number }
          | undefined;
        if (!existing) {
          this.stmtInsertOv.run(
            e.id,
            e.timestamp,
            e.date,
            e.hour,
            e.yearMonth,
            e.isoYear,
            e.isoWeek,
            e.yearWeek,
            e.stationCode,
            e.name,
            e.capacity,
            e.available,
            e.rented,
            e.newRentals
          );
          this.stmtUpsertOvDaily.run(
            e.stationCode,
            e.date,
            e.yearMonth,
            e.yearWeek,
            1,
            e.available,
            e.rented,
            e.newRentals,
            e.rented
          );
          insertedCount++;
        } else {
          if (
            existing.available === e.available &&
            existing.rented === e.rented &&
            existing.new_rentals === e.newRentals
          ) {
            continue;
          }
          this.stmtUpdateOv.run(
            e.timestamp,
            e.capacity,
            e.available,
            e.rented,
            e.newRentals,
            e.id
          );
          this.stmtUpsertOvDaily.run(
            e.stationCode,
            e.date,
            e.yearMonth,
            e.yearWeek,
            0,
            e.available - existing.available,
            e.rented - existing.rented,
            e.newRentals - existing.new_rentals,
            e.rented
          );
          if (e.rented < existing.rented) {
            daysToRecomputePeak.add(`${e.stationCode}::${e.date}`);
          }
        }
      }
      for (const key of daysToRecomputePeak) {
        const [stationCode, date] = key.split('::');
        this.stmtRecomputeOvPeak.run(stationCode, date, stationCode, date);
      }
      if (insertedCount > 0) {
        this.stmtIncCount.run(insertedCount, 'ovfiets_logs');
      }
      return insertedCount;
    });
  }

  // -------------------------------------------------------------
  // One-Time Legacy JSON Migration (if SQLite table is empty)
  // -------------------------------------------------------------
  public migrateLegacyJsonIfEmpty(files: {
    punctuality: string[];
    aansluitingen: string[];
    deelfiets: string[];
    ovfiets: string[];
  }) {
    if (this.getTotalCount('punctuality_logs') === 0) {
      const map = new Map<string, PunctualityLogEntry>();
      for (const fp of files.punctuality) {
        try {
          if (fs.existsSync(fp)) {
            const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item && item.id) map.set(item.id, item);
              }
            }
          }
        } catch (err) {
          console.warn(`Legacy migration warning (${path.basename(fp)}):`, err);
        }
      }
      if (map.size > 0) {
        const count = this.upsertPunctualityBatch(Array.from(map.values()));
        console.log(`SQLite migratie: ${count} stiptheidsmetingen geïmporteerd.`);
      }
    }

    if (this.getTotalCount('aansluitingen_logs') === 0) {
      const map = new Map<string, ConnectionLogEntry>();
      for (const fp of files.aansluitingen) {
        try {
          if (fs.existsSync(fp)) {
            const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item && item.id) map.set(item.id, item);
              }
            }
          }
        } catch (err) {
          console.warn(`Legacy migration warning (${path.basename(fp)}):`, err);
        }
      }
      if (map.size > 0) {
        const count = this.upsertAansluitingenBatch(Array.from(map.values()));
        console.log(`SQLite migratie: ${count} aansluitingsmetingen geïmporteerd.`);
      }
    }

    if (this.getTotalCount('deelfiets_logs') === 0) {
      const map = new Map<string, DeelfietsLogEntry>();
      for (const fp of files.deelfiets) {
        try {
          if (fs.existsSync(fp)) {
            const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item && item.id) map.set(item.id, item);
              }
            }
          }
        } catch (err) {
          console.warn(`Legacy migration warning (${path.basename(fp)}):`, err);
        }
      }
      if (map.size > 0) {
        const count = this.upsertDeelfietsBatch(Array.from(map.values()));
        console.log(`SQLite migratie: ${count} deelfietsmetingen geïmporteerd.`);
      }
    }

    if (this.getTotalCount('ovfiets_logs') === 0) {
      const map = new Map<string, OvFietsLogEntry>();
      for (const fp of files.ovfiets) {
        try {
          if (fs.existsSync(fp)) {
            const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item && item.id) map.set(item.id, item);
              }
            }
          }
        } catch (err) {
          console.warn(`Legacy migration warning (${path.basename(fp)}):`, err);
        }
      }
      if (map.size > 0) {
        const count = this.upsertOvfietsBatch(Array.from(map.values()));
        console.log(`SQLite migratie: ${count} OV-fietsmetingen geïmporteerd.`);
      }
    }
  }

  // -------------------------------------------------------------
  // 1. Punctuality Analytics & Paginated Queries
  // -------------------------------------------------------------
  public getPunctualityMapSummary(): {
    totalCount: number;
    stopPopupStats: Record<string, StopPopupSummary>;
  } {
    const totalCount = this.getTotalCount('punctuality_logs');
    const rows = this.db
      .prepare(`
        SELECT
          town,
          stop_name,
          SUM(total_count) AS total_count,
          SUM(cancelled_count) AS cancelled_count,
          SUM(delayed_count) AS delayed_count,
          SUM(sum_delay_delayed) AS sum_delay_delayed,
          SUM(early_count) AS early_count,
          SUM(sum_early_abs) AS sum_early_abs
        FROM punctuality_total_rollups
        GROUP BY town, stop_name
      `)
      .all() as any[];

    const stopPopupStats: Record<string, StopPopupSummary> = {};
    for (const r of rows) {
      const key = `${r.town}::${r.stop_name}`;
      const delayedCount = Number(r.delayed_count || 0);
      const earlyCount = Number(r.early_count || 0);
      stopPopupStats[key] = {
        town: r.town,
        stopName: r.stop_name,
        totalTrips: Number(r.total_count || 0),
        cancelledTrips: Number(r.cancelled_count || 0),
        delayedCount,
        avgDelayMin:
          delayedCount > 0
            ? (Number(r.sum_delay_delayed || 0) / delayedCount).toFixed(1)
            : '0.0',
        earlyCount,
        avgEarlyMin:
          earlyCount > 0
            ? (Number(r.sum_early_abs || 0) / earlyCount).toFixed(1)
            : '0.0',
      };
    }

    return { totalCount, stopPopupStats };
  }

  private buildPunctualityWhere(
    params: PunctualityQueryParams,
    alias = 'p'
  ): {
    whereSql: string;
    sqlParams: (string | number)[];
    needsFtsJoin: boolean;
    ftsMatch: string | null;
  } {
    const conditions: string[] = [];
    const sqlParams: (string | number)[] = [];
    let needsFtsJoin = false;
    let ftsMatch: string | null = null;

    if (params.periodType === 'month' && params.yearMonth) {
      conditions.push(`${alias}.year_month = ?`);
      sqlParams.push(params.yearMonth);
    } else if (params.periodType === 'week' && params.yearWeek) {
      conditions.push(`${alias}.year_week = ?`);
      sqlParams.push(params.yearWeek);
    }

    if (params.line && params.line !== 'ALL') {
      conditions.push(`${alias}.line = ?`);
      sqlParams.push(params.line);
    }

    if (params.searchQuery && params.searchQuery.trim() !== '') {
      ftsMatch = sanitizeFtsQuery(params.searchQuery);
      if (ftsMatch) {
        needsFtsJoin = true;
      }
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereSql, sqlParams, needsFtsJoin, ftsMatch };
  }

  public getPunctualityDashboardData(params: PunctualityQueryParams = {}) {
    const nowInfo = getISOWeekInfo(new Date());
    const periodType = params.periodType || 'all';
    const yearMonth = params.yearMonth || nowInfo.yearMonth;
    const yearWeek = params.yearWeek || nowInfo.yearWeek;
    const lineFilter = params.line || 'ALL';
    const searchQuery = (params.searchQuery || '').trim();
    const searchLower = searchQuery.toLowerCase();
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(200, Math.max(10, Number(params.pageSize || 50)));
    const includeRaw = params.includeRaw !== false;

    const totalCount = this.getTotalCount('punctuality_logs');

    // Available filter dropdown values from compact rollups
    const monthRows = this.db
      .prepare('SELECT DISTINCT year_month FROM punctuality_daily_rollups ORDER BY year_month DESC')
      .all() as { year_month: string }[];
    const availableMonths = Array.from(
      new Set([nowInfo.yearMonth, ...monthRows.map((r) => r.year_month)])
    ).sort().reverse();

    const weekRows = this.db
      .prepare('SELECT DISTINCT year_week FROM punctuality_daily_rollups ORDER BY year_week DESC')
      .all() as { year_week: string }[];
    const availableWeeks = Array.from(
      new Set([nowInfo.yearWeek, ...weekRows.map((r) => r.year_week)])
    ).sort().reverse();

    const lineRows = this.db
      .prepare('SELECT DISTINCT line FROM punctuality_total_rollups')
      .all() as { line: string }[];
    const lineSet = new Set<string>([
      '18', '20', '26', '70', '71', '76', '146', '171', '214', '217', '270', '524', '675', '679',
    ]);
    lineRows.forEach((r) => {
      if (r.line) lineSet.add(r.line);
    });
    const availableLines = Array.from(lineSet).sort((a, b) => Number(a) - Number(b));

    // Read rollup rows matching period + line
    const useTotalRollup = periodType === 'all';
    const rollupTable = useTotalRollup
      ? 'punctuality_total_rollups'
      : 'punctuality_daily_rollups';
    const rConds: string[] = [];
    const rParams: string[] = [];
    if (periodType === 'month') {
      rConds.push('year_month = ?');
      rParams.push(yearMonth);
    } else if (periodType === 'week') {
      rConds.push('year_week = ?');
      rParams.push(yearWeek);
    }
    if (lineFilter && lineFilter !== 'ALL') {
      rConds.push('line = ?');
      rParams.push(lineFilter);
    }
    const rWhere = rConds.length > 0 ? `WHERE ${rConds.join(' AND ')}` : '';

    const rollupRows = this.db
      .prepare(`
        SELECT
          town,
          stop_name,
          line,
          MAX(operator) AS operator,
          SUM(total_count) AS total_count,
          SUM(cancelled_count) AS cancelled_count,
          SUM(delayed_count) AS delayed_count,
          SUM(sum_delay_delayed) AS sum_delay_delayed,
          SUM(early_count) AS early_count,
          SUM(sum_early_abs) AS sum_early_abs,
          SUM(ontime_count) AS ontime_count,
          SUM(operated_count) AS operated_count
        FROM ${rollupTable}
        ${rWhere}
        GROUP BY town, stop_name, line
      `)
      .all(...rParams) as any[];

    // Compute stopStats, lineStats, and summary from rollups in < 1ms
    const stopAggMap = new Map<
      string,
      {
        total: number;
        cancelled: number;
        delayed: number;
        sumDelay: number;
        early: number;
        sumEarly: number;
        ontime: number;
        operated: number;
      }
    >();
    const lineAggMap = new Map<
      string,
      {
        operator: string;
        total: number;
        cancelled: number;
        delayed: number;
        sumDelay: number;
        early: number;
        sumEarly: number;
        ontime: number;
        operated: number;
      }
    >();

    for (const lineKey of Object.keys(LINE_DESCRIPTIONS)) {
      lineAggMap.set(lineKey, {
        operator: LINE_DESCRIPTIONS[lineKey].operator,
        total: 0,
        cancelled: 0,
        delayed: 0,
        sumDelay: 0,
        early: 0,
        sumEarly: 0,
        ontime: 0,
        operated: 0,
      });
    }

    let kpiTotal = 0;
    let kpiCancelled = 0;
    let kpiDelayed = 0;
    let kpiSumDelay = 0;
    let kpiEarly = 0;
    let kpiSumEarly = 0;
    let kpiOntime = 0;

    for (const r of rollupRows) {
      const t = Number(r.total_count || 0);
      const ca = Number(r.cancelled_count || 0);
      const de = Number(r.delayed_count || 0);
      const sde = Number(r.sum_delay_delayed || 0);
      const ea = Number(r.early_count || 0);
      const sea = Number(r.sum_early_abs || 0);
      const on = Number(r.ontime_count || 0);
      const op = Number(r.operated_count || 0);

      // Line stats do not filter by searchQuery (matching original computeLineStats)
      const lEntry = lineAggMap.get(r.line) || {
        operator: r.operator || 'OV Steenwijkerland',
        total: 0,
        cancelled: 0,
        delayed: 0,
        sumDelay: 0,
        early: 0,
        sumEarly: 0,
        ontime: 0,
        operated: 0,
      };
      lEntry.total += t;
      lEntry.cancelled += ca;
      lEntry.delayed += de;
      lEntry.sumDelay += sde;
      lEntry.early += ea;
      lEntry.sumEarly += sea;
      lEntry.ontime += on;
      lEntry.operated += op;
      lineAggMap.set(r.line, lEntry);

      // Stop stats & KPI respect searchQuery
      const matchesSearch =
        !searchLower ||
        String(r.town || '').toLowerCase().includes(searchLower) ||
        String(r.stop_name || '').toLowerCase().includes(searchLower) ||
        String(r.line || '').toLowerCase().includes(searchLower);

      if (matchesSearch) {
        kpiTotal += t;
        kpiCancelled += ca;
        kpiDelayed += de;
        kpiSumDelay += sde;
        kpiEarly += ea;
        kpiSumEarly += sea;
        kpiOntime += on;

        const stopKey = `${r.town}::${r.stop_name}`;
        const sEntry = stopAggMap.get(stopKey) || {
          total: 0,
          cancelled: 0,
          delayed: 0,
          sumDelay: 0,
          early: 0,
          sumEarly: 0,
          ontime: 0,
          operated: 0,
        };
        sEntry.total += t;
        sEntry.cancelled += ca;
        sEntry.delayed += de;
        sEntry.sumDelay += sde;
        sEntry.early += ea;
        sEntry.sumEarly += sea;
        sEntry.ontime += on;
        sEntry.operated += op;
        stopAggMap.set(stopKey, sEntry);
      }
    }

    // Deduplicate physical stops cleanly matching computeStopStats()
    const uniqueStopsMap = new Map<string, (typeof STEENWIJKERLAND_STOPS)[number]>();
    for (const s of STEENWIJKERLAND_STOPS) {
      const key = `${s.town}::${s.name}`;
      const existing = uniqueStopsMap.get(key);
      if (!existing) {
        uniqueStopsMap.set(key, s);
      } else {
        uniqueStopsMap.set(key, {
          ...existing,
          lines: Array.from(new Set([...existing.lines, ...s.lines])),
        });
      }
    }

    const stopStats: StopPunctualityStats[] = [];
    for (const [key, stop] of uniqueStopsMap.entries()) {
      if (lineFilter && lineFilter !== 'ALL' && !stop.lines.includes(lineFilter)) {
        continue;
      }
      if (
        searchLower &&
        !stop.town.toLowerCase().includes(searchLower) &&
        !stop.name.toLowerCase().includes(searchLower) &&
        !stop.lines.some((l) => l.toLowerCase().includes(searchLower))
      ) {
        continue;
      }
      const agg = stopAggMap.get(key);
      const total = agg?.total || 0;
      const cancelled = agg?.cancelled || 0;
      const delayed = agg?.delayed || 0;
      const sumDelay = agg?.sumDelay || 0;
      const early = agg?.early || 0;
      const sumEarly = agg?.sumEarly || 0;
      const ontime = agg?.ontime || 0;
      const operated = agg?.operated || 0;

      stopStats.push({
        stopId: stop.id,
        stopCode: stop.stopCode || '',
        town: stop.town,
        stopName: stop.name,
        lines: stop.lines,
        totalRecordedTrips: total,
        cancelledCount: cancelled,
        cancelledPercent: total > 0 ? Number(((cancelled / total) * 100).toFixed(1)) : 0,
        delayedCount: delayed,
        avgDelayWhenDelayedMin: delayed > 0 ? Number((sumDelay / delayed).toFixed(2)) : 0,
        avgDelayAllOperatedMin: operated > 0 ? Number((sumDelay / operated).toFixed(2)) : 0,
        earlyCount: early,
        avgEarlyMinutes: early > 0 ? Number((sumEarly / early).toFixed(2)) : 0,
        onTimeCount: ontime,
        onTimePercent: total > 0 ? Number(((ontime / total) * 100).toFixed(1)) : 0,
      });
    }
    stopStats.sort((a, b) => {
      if (b.totalRecordedTrips !== a.totalRecordedTrips) {
        return b.totalRecordedTrips - a.totalRecordedTrips;
      }
      return a.town.localeCompare(b.town) || a.stopName.localeCompare(b.stopName);
    });

    const lineStats: LinePunctualityStats[] = [];
    for (const [line, agg] of lineAggMap.entries()) {
      if (lineFilter && lineFilter !== 'ALL' && line !== lineFilter) continue;
      const meta = LINE_DESCRIPTIONS[line] || {
        operator: agg.operator || 'OV Steenwijkerland',
        summary: `Lijn ${line}`,
      };
      lineStats.push({
        line,
        operator: meta.operator,
        routeSummary: meta.summary,
        totalRecordedTrips: agg.total,
        cancelledCount: agg.cancelled,
        cancelledPercent:
          agg.total > 0 ? Number(((agg.cancelled / agg.total) * 100).toFixed(1)) : 0,
        delayedCount: agg.delayed,
        avgDelayWhenDelayedMin:
          agg.delayed > 0 ? Number((agg.sumDelay / agg.delayed).toFixed(2)) : 0,
        avgDelayAllOperatedMin:
          agg.operated > 0 ? Number((agg.sumDelay / agg.operated).toFixed(2)) : 0,
        earlyCount: agg.early,
        avgEarlyMinutes: agg.early > 0 ? Number((agg.sumEarly / agg.early).toFixed(2)) : 0,
        onTimeCount: agg.ontime,
        onTimePercent:
          agg.total > 0 ? Number(((agg.ontime / agg.total) * 100).toFixed(1)) : 0,
      });
    }
    lineStats.sort((a, b) => Number(a.line) - Number(b.line));

    // Paginated raw rows (bounded to pageSize!)
    let logs: PunctualityLogEntry[] = [];
    let filteredTotal = kpiTotal;
    const totalPages = Math.max(1, Math.ceil(Math.max(1, filteredTotal) / pageSize));
    let safePage = Math.min(page, totalPages);

    if (includeRaw) {
      const { whereSql, sqlParams, needsFtsJoin, ftsMatch } = this.buildPunctualityWhere(
        { periodType, yearMonth, yearWeek, line: lineFilter, searchQuery },
        'p'
      );
      const offset = (safePage - 1) * pageSize;

      let rows: any[];
      if (needsFtsJoin && ftsMatch) {
        const extraCond = whereSql ? whereSql.replace(/^WHERE\s+/i, 'AND ') : '';
        filteredTotal = Number(
          (
            this.db
              .prepare(`
                SELECT COUNT(*) AS cnt
                FROM punctuality_fts
                JOIN punctuality_logs p ON p.rowid = punctuality_fts.rowid
                WHERE punctuality_fts MATCH ? ${extraCond}
              `)
              .get(ftsMatch, ...sqlParams) as { cnt: number }
          )?.cnt || 0
        );
        const ftsTotalPages = Math.max(1, Math.ceil(Math.max(1, filteredTotal) / pageSize));
        safePage = Math.min(page, ftsTotalPages);
        const ftsOffset = (safePage - 1) * pageSize;
        rows = this.db
          .prepare(`
            SELECT p.*
            FROM punctuality_fts
            JOIN punctuality_logs p ON p.rowid = punctuality_fts.rowid
            WHERE punctuality_fts MATCH ? ${extraCond}
            ORDER BY p.timestamp DESC, p.id DESC
            LIMIT ? OFFSET ?
          `)
          .all(ftsMatch, ...sqlParams, pageSize, ftsOffset) as any[];
      } else {
        rows = this.db
          .prepare(`
            SELECT p.*
            FROM punctuality_logs p
            ${whereSql}
            ORDER BY p.timestamp DESC, p.id DESC
            LIMIT ? OFFSET ?
          `)
          .all(...sqlParams, pageSize, offset) as any[];
      }

      logs = rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        date: r.date,
        yearMonth: r.year_month,
        isoYear: r.iso_year,
        isoWeek: r.iso_week,
        yearWeek: r.year_week,
        stopId: r.stop_id,
        stopCode: r.stop_code,
        stopName: r.stop_name,
        town: r.town,
        line: r.line,
        operator: r.operator,
        destination: r.destination,
        journeyId: r.journey_id,
        plannedTime: r.planned_time,
        actualTime: r.actual_time,
        delayMinutes: Number(r.delay_minutes),
        status: r.status,
      }));
    }

    return {
      totalCount,
      filteredTotal,
      page: safePage,
      pageSize,
      totalPages: Math.max(1, Math.ceil(Math.max(1, filteredTotal) / pageSize)),
      availableMonths,
      availableWeeks,
      availableLines,
      summary: {
        total: kpiTotal,
        cancelledCount: kpiCancelled,
        delayedCount: kpiDelayed,
        avgDelay: kpiDelayed > 0 ? (kpiSumDelay / kpiDelayed).toFixed(1) : '0.0',
        earlyCount: kpiEarly,
        avgEarly: kpiEarly > 0 ? (kpiSumEarly / kpiEarly).toFixed(1) : '0.0',
        onTimeCount: kpiOntime,
      },
      stopStats,
      lineStats,
      logs,
    };
  }

  // -------------------------------------------------------------
  // 2. Aansluitingen Analytics & Paginated Queries
  // -------------------------------------------------------------
  public getAansluitingenDashboardData(params: AansluitingenQueryParams = {}) {
    const nowInfo = getISOWeekInfo(new Date());
    const period = params.period || 'day';
    const direction = params.direction || 'all';
    const trainType = params.trainType || 'all';
    const lineFilter = params.line || 'all';
    const statusFilter = params.status || 'all';
    const search = (params.search || '').trim();
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(200, Math.max(10, Number(params.pageSize || 50)));
    const includeRaw = params.includeRaw !== false;

    const totalCount = this.getTotalCount('aansluitingen_logs');

    // Available lines from tiny total rollup table (< 0.1ms)
    const lineRows = this.db
      .prepare('SELECT DISTINCT bus_line FROM aansluitingen_total_rollups')
      .all() as { bus_line: string }[];
    const availableLines = lineRows
      .map((r) => r.bus_line)
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });

    // Aggregate ConnectionSummary for requested period from rollups
    const rollupTable =
      period === 'all' ? 'aansluitingen_total_rollups' : 'aansluitingen_daily_rollups';
    const rConds: string[] = [];
    const rParams: string[] = [];
    if (period === 'day') {
      rConds.push('date = ?');
      rParams.push(nowInfo.dateStr);
    } else if (period === 'week') {
      rConds.push('year_week = ?');
      rParams.push(nowInfo.yearWeek);
    } else if (period === 'month') {
      rConds.push('year_month = ?');
      rParams.push(nowInfo.yearMonth);
    }
    const rWhere = rConds.length > 0 ? `WHERE ${rConds.join(' AND ')}` : '';

    const rollupRows = this.db
      .prepare(`
        SELECT
          direction,
          train_type,
          bus_line,
          MAX(bus_operator) AS bus_operator,
          SUM(total_count) AS total_count,
          SUM(made_count) AS made_count,
          SUM(missed_count) AS missed_count,
          SUM(sum_planned_min) AS sum_planned_min,
          SUM(sum_realized_min) AS sum_realized_min
        FROM ${rollupTable}
        ${rWhere}
        GROUP BY direction, train_type, bus_line
      `)
      .all(...rParams) as any[];

    let totalPlanned = 0;
    let transfersMade = 0;
    let transfersMissed = 0;
    let sumPlanned = 0;
    let sumRealized = 0;

    const dirT = {
      bus_naar_trein: { total: 0, made: 0, sumP: 0, sumR: 0 },
      trein_naar_bus: { total: 0, made: 0, sumP: 0, sumR: 0 },
    };
    const typeT = {
      intercity: { total: 0, made: 0, sumP: 0, sumR: 0 },
      sprinter: { total: 0, made: 0, sumP: 0, sumR: 0 },
    };
    const crossT = {
      bus_naar_trein: {
        intercity: { total: 0, made: 0, sumP: 0, sumR: 0 },
        sprinter: { total: 0, made: 0, sumP: 0, sumR: 0 },
      },
      trein_naar_bus: {
        intercity: { total: 0, made: 0, sumP: 0, sumR: 0 },
        sprinter: { total: 0, made: 0, sumP: 0, sumR: 0 },
      },
    };
    const byLine: ConnectionSummary['byLine'] = {};

    for (const r of rollupRows) {
      const t = Number(r.total_count || 0);
      const m = Number(r.made_count || 0);
      const mi = Number(r.missed_count || 0);
      const sp = Number(r.sum_planned_min || 0);
      const sr = Number(r.sum_realized_min || 0);

      totalPlanned += t;
      transfersMade += m;
      transfersMissed += mi;
      sumPlanned += sp;
      sumRealized += sr;

      const dir: TransferDirection =
        r.direction === 'trein_naar_bus' ? 'trein_naar_bus' : 'bus_naar_trein';
      const isIc = r.train_type !== 'Sprinter';
      const tk = isIc ? 'intercity' : 'sprinter';

      dirT[dir].total += t;
      dirT[dir].made += m;
      dirT[dir].sumP += sp;
      dirT[dir].sumR += sr;

      typeT[tk].total += t;
      typeT[tk].made += m;
      typeT[tk].sumP += sp;
      typeT[tk].sumR += sr;

      crossT[dir][tk].total += t;
      crossT[dir][tk].made += m;
      crossT[dir][tk].sumP += sp;
      crossT[dir][tk].sumR += sr;

      const line = r.bus_line || 'Onbekend';
      if (!byLine[line]) {
        byLine[line] = {
          line,
          operator: r.bus_operator || 'OV',
          total: 0,
          made: 0,
          missed: 0,
          rate: 100,
          busToTrain: { total: 0, made: 0, missed: 0, rate: 100 },
          trainToBus: { total: 0, made: 0, missed: 0, rate: 100 },
          intercity: { total: 0, made: 0, missed: 0, rate: 100 },
          sprinter: { total: 0, made: 0, missed: 0, rate: 100 },
        };
      }
      const lo = byLine[line];
      lo.total += t;
      lo.made += m;
      lo.missed += mi;
      if (dir === 'bus_naar_trein') {
        lo.busToTrain.total += t;
        lo.busToTrain.made += m;
        lo.busToTrain.missed += mi;
      } else {
        lo.trainToBus.total += t;
        lo.trainToBus.made += m;
        lo.trainToBus.missed += mi;
      }
      if (isIc) {
        lo.intercity.total += t;
        lo.intercity.made += m;
        lo.intercity.missed += mi;
      } else {
        lo.sprinter.total += t;
        lo.sprinter.made += m;
        lo.sprinter.missed += mi;
      }
    }

    for (const lo of Object.values(byLine)) {
      lo.rate = lo.total > 0 ? Number(((lo.made / lo.total) * 100).toFixed(1)) : 100;
      lo.busToTrain.rate =
        lo.busToTrain.total > 0
          ? Number(((lo.busToTrain.made / lo.busToTrain.total) * 100).toFixed(1))
          : 100;
      lo.trainToBus.rate =
        lo.trainToBus.total > 0
          ? Number(((lo.trainToBus.made / lo.trainToBus.total) * 100).toFixed(1))
          : 100;
      lo.intercity.rate =
        lo.intercity.total > 0
          ? Number(((lo.intercity.made / lo.intercity.total) * 100).toFixed(1))
          : 100;
      lo.sprinter.rate =
        lo.sprinter.total > 0
          ? Number(((lo.sprinter.made / lo.sprinter.total) * 100).toFixed(1))
          : 100;
    }

    const summary: ConnectionSummary = {
      totalPlanned,
      transfersMade,
      transfersMissed,
      successRate:
        totalPlanned > 0 ? Number(((transfersMade / totalPlanned) * 100).toFixed(1)) : 100,
      avgPlannedBufferMin:
        totalPlanned > 0 ? Number((sumPlanned / totalPlanned).toFixed(1)) : 0,
      avgRealizedMarginMin:
        totalPlanned > 0 ? Number((sumRealized / totalPlanned).toFixed(1)) : 0,
      byDirection: {
        bus_naar_trein: computeDirectionStats(
          dirT.bus_naar_trein.total,
          dirT.bus_naar_trein.made,
          dirT.bus_naar_trein.sumP,
          dirT.bus_naar_trein.sumR
        ),
        trein_naar_bus: computeDirectionStats(
          dirT.trein_naar_bus.total,
          dirT.trein_naar_bus.made,
          dirT.trein_naar_bus.sumP,
          dirT.trein_naar_bus.sumR
        ),
      },
      byTrainType: {
        intercity: computeDirectionStats(
          typeT.intercity.total,
          typeT.intercity.made,
          typeT.intercity.sumP,
          typeT.intercity.sumR
        ),
        sprinter: computeDirectionStats(
          typeT.sprinter.total,
          typeT.sprinter.made,
          typeT.sprinter.sumP,
          typeT.sprinter.sumR
        ),
      },
      byDirectionAndTrainType: {
        bus_naar_trein: {
          intercity: computeDirectionStats(
            crossT.bus_naar_trein.intercity.total,
            crossT.bus_naar_trein.intercity.made,
            crossT.bus_naar_trein.intercity.sumP,
            crossT.bus_naar_trein.intercity.sumR
          ),
          sprinter: computeDirectionStats(
            crossT.bus_naar_trein.sprinter.total,
            crossT.bus_naar_trein.sprinter.made,
            crossT.bus_naar_trein.sprinter.sumP,
            crossT.bus_naar_trein.sprinter.sumR
          ),
        },
        trein_naar_bus: {
          intercity: computeDirectionStats(
            crossT.trein_naar_bus.intercity.total,
            crossT.trein_naar_bus.intercity.made,
            crossT.trein_naar_bus.intercity.sumP,
            crossT.trein_naar_bus.intercity.sumR
          ),
          sprinter: computeDirectionStats(
            crossT.trein_naar_bus.sprinter.total,
            crossT.trein_naar_bus.sprinter.made,
            crossT.trein_naar_bus.sprinter.sumP,
            crossT.trein_naar_bus.sprinter.sumR
          ),
        },
      },
      byLine,
    };

    // Exact filtered count from rollup (O(lines), instant!) when no free-text search is active
    let filteredTotal = 0;
    for (const r of rollupRows) {
      if (direction !== 'all' && r.direction !== direction) continue;
      if (trainType !== 'all' && r.train_type !== trainType) continue;
      if (lineFilter !== 'all' && r.bus_line !== lineFilter) continue;
      if (statusFilter === 'gehaald') filteredTotal += Number(r.made_count || 0);
      else if (statusFilter === 'gemist') filteredTotal += Number(r.missed_count || 0);
      else filteredTotal += Number(r.total_count || 0);
    }

    let logs: ConnectionLogEntry[] = [];
    let safePage = page;

    if (includeRaw) {
      const conds: string[] = [];
      const sqlParams: (string | number)[] = [];
      if (period === 'day') {
        conds.push('a.date = ?');
        sqlParams.push(nowInfo.dateStr);
      } else if (period === 'week') {
        conds.push('a.year_week = ?');
        sqlParams.push(nowInfo.yearWeek);
      } else if (period === 'month') {
        conds.push('a.year_month = ?');
        sqlParams.push(nowInfo.yearMonth);
      }
      if (direction !== 'all') {
        conds.push('a.direction = ?');
        sqlParams.push(direction);
      }
      if (trainType !== 'all') {
        conds.push('a.train_type = ?');
        sqlParams.push(trainType);
      }
      if (lineFilter !== 'all') {
        conds.push('a.bus_line = ?');
        sqlParams.push(lineFilter);
      }
      if (statusFilter !== 'all') {
        conds.push('a.status = ?');
        sqlParams.push(statusFilter);
      }

      const ftsMatch = search ? sanitizeFtsQuery(search) : null;
      let rows: any[];

      if (ftsMatch) {
        const extraCond = conds.length > 0 ? `AND ${conds.join(' AND ')}` : '';
        filteredTotal = Number(
          (
            this.db
              .prepare(`
                SELECT COUNT(*) AS cnt
                FROM aansluitingen_fts
                JOIN aansluitingen_logs a ON a.rowid = aansluitingen_fts.rowid
                WHERE aansluitingen_fts MATCH ? ${extraCond}
              `)
              .get(ftsMatch, ...sqlParams) as { cnt: number }
          )?.cnt || 0
        );
        const totalPagesFts = Math.max(1, Math.ceil(Math.max(1, filteredTotal) / pageSize));
        safePage = Math.min(page, totalPagesFts);
        const offset = (safePage - 1) * pageSize;

        rows = this.db
          .prepare(`
            SELECT a.*
            FROM aansluitingen_fts
            JOIN aansluitingen_logs a ON a.rowid = aansluitingen_fts.rowid
            WHERE aansluitingen_fts MATCH ? ${extraCond}
            ORDER BY a.timestamp DESC, a.id DESC
            LIMIT ? OFFSET ?
          `)
          .all(ftsMatch, ...sqlParams, pageSize, offset) as any[];
      } else {
        const totalPagesNormal = Math.max(1, Math.ceil(Math.max(1, filteredTotal) / pageSize));
        safePage = Math.min(page, totalPagesNormal);
        const offset = (safePage - 1) * pageSize;
        const whereSql = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

        rows = this.db
          .prepare(`
            SELECT a.*
            FROM aansluitingen_logs a
            ${whereSql}
            ORDER BY a.timestamp DESC, a.id DESC
            LIMIT ? OFFSET ?
          `)
          .all(...sqlParams, pageSize, offset) as any[];
      }

      logs = rows.map((r) => ({
        id: r.id,
        direction: r.direction,
        timestamp: r.timestamp,
        date: r.date,
        yearMonth: r.year_month,
        isoYear: r.iso_year,
        isoWeek: r.iso_week,
        yearWeek: r.year_week,
        busLine: r.bus_line,
        busOperator: r.bus_operator,
        busDestination: r.bus_destination,
        busPlannedArrival: r.bus_planned_arrival ?? undefined,
        busActualArrival: r.bus_actual_arrival ?? undefined,
        busPlannedDeparture: r.bus_planned_departure ?? undefined,
        busActualDeparture: r.bus_actual_departure ?? undefined,
        busDelayMinutes: Number(r.bus_delay_minutes),
        trainNumber: r.train_number,
        trainType: r.train_type,
        trainDestination: r.train_destination,
        trainOrigin: r.train_origin ?? undefined,
        trainPlatform: r.train_platform,
        trainPlannedDeparture: r.train_planned_departure ?? undefined,
        trainActualDeparture: r.train_actual_departure ?? undefined,
        trainPlannedArrival: r.train_planned_arrival ?? undefined,
        trainActualArrival: r.train_actual_arrival ?? undefined,
        trainDelayMinutes: Number(r.train_delay_minutes),
        originVehicle: r.origin_vehicle,
        connectingVehicle: r.connecting_vehicle,
        plannedOriginArrival: r.planned_origin_arrival,
        actualOriginArrival: r.actual_origin_arrival,
        plannedConnectingDeparture: r.planned_connecting_departure,
        actualConnectingDeparture: r.actual_connecting_departure,
        plannedTransferMinutes: Number(r.planned_transfer_minutes),
        realizedTransferMinutes: Number(r.realized_transfer_minutes),
        status: r.status,
        notes: r.notes ?? undefined,
      }));
    }

    const totalPages = Math.max(1, Math.ceil(Math.max(1, filteredTotal) / pageSize));
    return {
      totalCount,
      filteredTotal,
      page: safePage,
      pageSize,
      totalPages,
      availableLines,
      summary,
      logs,
    };
  }

  // -------------------------------------------------------------
  // 3. Deelfiets Analytics & Queries (via deelfiets_daily_rollups)
  // -------------------------------------------------------------
  public getDeelfietsDashboardData(
    locations: DeelfietsLocation[],
    params: DeelfietsQueryParams = {}
  ) {
    const nowInfo = getISOWeekInfo(new Date());
    const targetDay = params.day || nowInfo.dateStr;
    const targetWeek = params.week || nowInfo.yearWeek;
    const targetMonth = params.month || nowInfo.yearMonth;
    const activeMode = params.mode || 'day';
    const townFilter = params.town || 'ALL';
    const searchLower = (params.search || '').trim().toLowerCase();

    const totalCount = this.getTotalCount('deelfiets_logs');

    const dayRows = this.db
      .prepare('SELECT DISTINCT date FROM deelfiets_daily_rollups ORDER BY date DESC')
      .all() as { date: string }[];
    const weekRows = this.db
      .prepare('SELECT DISTINCT year_week FROM deelfiets_daily_rollups ORDER BY year_week DESC')
      .all() as { year_week: string }[];
    const monthRows = this.db
      .prepare('SELECT DISTINCT year_month FROM deelfiets_daily_rollups ORDER BY year_month DESC')
      .all() as { year_month: string }[];

    const availableDays = Array.from(new Set([nowInfo.dateStr, ...dayRows.map((r) => r.date)])).sort().reverse();
    const availableWeeks = Array.from(new Set([nowInfo.yearWeek, ...weekRows.map((r) => r.year_week)])).sort().reverse();
    const availableMonths = Array.from(new Set([nowInfo.yearMonth, ...monthRows.map((r) => r.year_month)])).sort().reverse();

    const queryAgg = (col: 'date' | 'year_week' | 'year_month', val: string) => {
      const rows = this.db
        .prepare(`
          SELECT
            station_id,
            SUM(sample_count) AS samples,
            SUM(sum_available) AS sum_avail,
            SUM(sum_rented) AS sum_rent,
            SUM(MAX(sum_new_rentals, peak_concurrent_rented)) AS total_rented,
            COUNT(*) AS days_covered
          FROM deelfiets_daily_rollups
          WHERE ${col} = ?
          GROUP BY station_id
        `)
        .all(val) as any[];

      const map = new Map<
        string,
        { samples: number; avgAvailable: number; avgRented: number; totalRented: number; daysCovered: number }
      >();
      for (const r of rows) {
        const samples = Number(r.samples || 0);
        map.set(r.station_id, {
          samples,
          avgAvailable: samples > 0 ? Number((Number(r.sum_avail || 0) / samples).toFixed(1)) : 0,
          avgRented: samples > 0 ? Number((Number(r.sum_rent || 0) / samples).toFixed(1)) : 0,
          totalRented: Number(r.total_rented || 0),
          daysCovered: Number(r.days_covered || 0),
        });
      }
      return map;
    };

    const dayMap = queryAgg('date', targetDay);
    const weekMap = queryAgg('year_week', targetWeek);
    const monthMap = queryAgg('year_month', targetMonth);

    const periodLabel =
      activeMode === 'day' ? targetDay : activeMode === 'week' ? targetWeek : targetMonth;

    const allStats: DeelfietsPeriodStats[] = locations.map((loc) => {
      const dm = dayMap.get(loc.stationId) || {
        samples: 0,
        avgAvailable: loc.available,
        avgRented: loc.rented,
        totalRented: loc.rented,
        daysCovered: 1,
      };
      const wm = weekMap.get(loc.stationId) || {
        samples: 0,
        avgAvailable: loc.available,
        avgRented: loc.rented,
        totalRented: loc.rented,
        daysCovered: 1,
      };
      const mm = monthMap.get(loc.stationId) || {
        samples: 0,
        avgAvailable: loc.available,
        avgRented: loc.rented,
        totalRented: loc.rented,
        daysCovered: 1,
      };
      const activeM = activeMode === 'day' ? dm : activeMode === 'week' ? wm : mm;

      return {
        stationId: loc.stationId,
        locationName: loc.name,
        town: loc.town,
        streetAddress: loc.streetAddress,
        electric: loc.electric,
        isCargoBike: loc.isCargoBike,
        periodLabel,
        sampleCount: activeM.samples,
        daysCovered: activeM.daysCovered,
        currentAvailable: loc.available,
        currentRented: loc.rented,
        capacity: loc.capacity,
        avgAvailableBikes: activeM.avgAvailable,
        avgRentedBikes: activeM.avgRented,
        totalRentedBikes: activeM.totalRented,
        avgAvailableDay: dm.avgAvailable,
        avgAvailableWeek: wm.avgAvailable,
        avgAvailableMonth: mm.avgAvailable,
        avgRentedDay: dm.avgRented,
        avgRentedWeek: wm.avgRented,
        avgRentedMonth: mm.avgRented,
        totalRentedDay: dm.totalRented,
        totalRentedWeek: wm.totalRented,
        totalRentedMonth: mm.totalRented,
      };
    });

    const statsList = allStats.filter((st) => {
      if (townFilter !== 'ALL' && st.town !== townFilter) return false;
      if (searchLower) {
        return (
          st.locationName.toLowerCase().includes(searchLower) ||
          st.town.toLowerCase().includes(searchLower) ||
          st.streetAddress.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });

    const summary = {
      currentAvailable: statsList.reduce((a, b) => a + b.currentAvailable, 0),
      currentRented: statsList.reduce((a, b) => a + b.currentRented, 0),
      totalCapacity: statsList.reduce((a, b) => a + b.capacity, 0),
      avgAvailDay: Number(statsList.reduce((a, b) => a + b.avgAvailableDay, 0).toFixed(1)),
      avgAvailWeek: Number(statsList.reduce((a, b) => a + b.avgAvailableWeek, 0).toFixed(1)),
      avgAvailMonth: Number(statsList.reduce((a, b) => a + b.avgAvailableMonth, 0).toFixed(1)),
      avgRentedDay: Number(statsList.reduce((a, b) => a + b.avgRentedDay, 0).toFixed(1)),
      avgRentedWeek: Number(statsList.reduce((a, b) => a + b.avgRentedWeek, 0).toFixed(1)),
      avgRentedMonth: Number(statsList.reduce((a, b) => a + b.avgRentedMonth, 0).toFixed(1)),
      totalRentedDay: statsList.reduce((a, b) => a + b.totalRentedDay, 0),
      totalRentedWeek: statsList.reduce((a, b) => a + b.totalRentedWeek, 0),
      totalRentedMonth: statsList.reduce((a, b) => a + b.totalRentedMonth, 0),
    };

    return {
      totalCount,
      availableDays,
      availableWeeks,
      availableMonths,
      statsList,
      allStats,
      summary,
    };
  }

  // -------------------------------------------------------------
  // 4. OV-fiets Analytics (via ovfiets_daily_rollups)
  // -------------------------------------------------------------
  public getOvFietsDashboardData(
    loc: OvFietsLocation,
    params: OvFietsQueryParams = {}
  ) {
    const nowInfo = getISOWeekInfo(new Date());
    const targetDay = params.day || nowInfo.dateStr;
    const targetWeek = params.week || nowInfo.yearWeek;
    const targetMonth = params.month || nowInfo.yearMonth;
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(200, Math.max(10, Number(params.pageSize || 50)));
    const includeRaw = params.includeRaw !== false;

    const totalCount = this.getTotalCount('ovfiets_logs');

    const dayRows = this.db
      .prepare('SELECT DISTINCT date FROM ovfiets_daily_rollups ORDER BY date DESC')
      .all() as { date: string }[];
    const weekRows = this.db
      .prepare('SELECT DISTINCT year_week FROM ovfiets_daily_rollups ORDER BY year_week DESC')
      .all() as { year_week: string }[];
    const monthRows = this.db
      .prepare('SELECT DISTINCT year_month FROM ovfiets_daily_rollups ORDER BY year_month DESC')
      .all() as { year_month: string }[];

    const availableDays = Array.from(new Set([nowInfo.dateStr, ...dayRows.map((r) => r.date)])).sort().reverse();
    const availableWeeks = Array.from(new Set([nowInfo.yearWeek, ...weekRows.map((r) => r.year_week)])).sort().reverse();
    const availableMonths = Array.from(new Set([nowInfo.yearMonth, ...monthRows.map((r) => r.year_month)])).sort().reverse();

    const queryOvMetrics = (col: 'date' | 'year_week' | 'year_month', val: string) => {
      const row = this.db
        .prepare(`
          SELECT
            SUM(sample_count) AS samples,
            SUM(sum_available) AS sum_avail,
            SUM(sum_rented) AS sum_rent,
            SUM(MAX(sum_new_rentals, peak_concurrent_rented)) AS total_rented
          FROM ovfiets_daily_rollups
          WHERE station_code = ? AND ${col} = ?
        `)
        .get(loc.stationCode, val) as any;

      const samples = Number(row?.samples || 0);
      if (samples === 0) {
        return {
          avgAvailable: loc.available,
          avgRented: loc.rented,
          totalRented: loc.rented,
        };
      }
      return {
        avgAvailable: Number((Number(row.sum_avail || 0) / samples).toFixed(1)),
        avgRented: Number((Number(row.sum_rent || 0) / samples).toFixed(1)),
        totalRented: Number(row.total_rented || 0),
      };
    };

    const dm = queryOvMetrics('date', targetDay);
    const wm = queryOvMetrics('year_week', targetWeek);
    const mm = queryOvMetrics('year_month', targetMonth);

    const stats: OvFietsPeriodStats = {
      stationCode: loc.stationCode,
      name: loc.name,
      town: loc.town,
      streetAddress: loc.streetAddress,
      currentAvailable: loc.available,
      currentRented: loc.rented,
      capacity: loc.totalCapacity,
      avgAvailableDay: dm.avgAvailable,
      avgAvailableWeek: wm.avgAvailable,
      avgAvailableMonth: mm.avgAvailable,
      avgRentedDay: dm.avgRented,
      avgRentedWeek: wm.avgRented,
      avgRentedMonth: mm.avgRented,
      totalRentedDay: dm.totalRented,
      totalRentedWeek: wm.totalRented,
      totalRentedMonth: mm.totalRented,
    };

    let logs: OvFietsLogEntry[] = [];
    const totalPages = Math.max(1, Math.ceil(Math.max(1, totalCount) / pageSize));
    const safePage = Math.min(page, totalPages);

    if (includeRaw) {
      const offset = (safePage - 1) * pageSize;
      const rows = this.db
        .prepare(`
          SELECT * FROM ovfiets_logs
          ORDER BY timestamp DESC, id DESC
          LIMIT ? OFFSET ?
        `)
        .all(pageSize, offset) as any[];
      logs = rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        date: r.date,
        hour: r.hour,
        yearMonth: r.year_month,
        isoYear: r.iso_year,
        isoWeek: r.iso_week,
        yearWeek: r.year_week,
        stationCode: r.station_code,
        name: r.name,
        capacity: Number(r.capacity),
        available: Number(r.available),
        rented: Number(r.rented),
        newRentals: Number(r.new_rentals),
      }));
    }

    return {
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      availableDays,
      availableWeeks,
      availableMonths,
      stats,
      logs,
    };
  }

  // -------------------------------------------------------------
  // 5. Constant-Memory Streaming CSV Export Engine (Billion-Row Safe)
  // -------------------------------------------------------------
  private async streamCursorAsCsv(
    req: Request,
    res: Response,
    filename: string,
    headerLine: string,
    lineEnding: string,
    bom: boolean,
    stmt: StatementSync,
    params: (string | number)[],
    formatRow: (row: any) => string
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.flushHeaders();

    let clientClosed = false;
    const onClose = () => {
      clientClosed = true;
    };
    req.on('close', onClose);

    const writeChunk = async (chunk: string): Promise<boolean> => {
      if (clientClosed || res.destroyed || res.writableEnded) return false;
      const canContinue = res.write(chunk, 'utf8');
      if (!canContinue) {
        await new Promise<void>((resolve) => {
          const cleanup = () => {
            res.off('drain', onDrain);
            res.off('close', onDone);
            res.off('error', onDone);
            resolve();
          };
          const onDrain = () => cleanup();
          const onDone = () => {
            clientClosed = true;
            cleanup();
          };
          res.once('drain', onDrain);
          res.once('close', onDone);
          res.once('error', onDone);
        });
      }
      return !clientClosed;
    };

    try {
      const prefix = (bom ? '\uFEFF' : '') + headerLine + lineEnding;
      if (!(await writeChunk(prefix))) return;

      const BATCH_SIZE = 500;
      let lines: string[] = [];
      let batchCounter = 0;

      for (const row of stmt.iterate(...params)) {
        if (clientClosed) break;
        lines.push(formatRow(row));
        if (lines.length >= BATCH_SIZE) {
          const chunk = lines.join(lineEnding) + lineEnding;
          lines = [];
          if (!(await writeChunk(chunk))) break;
          batchCounter++;
          // Yield to the event loop periodically so live bus/train endpoints remain responsive during huge exports
          if (batchCounter % 4 === 0) {
            await new Promise((r) => setImmediate(r));
          }
        }
      }

      if (!clientClosed && lines.length > 0) {
        await writeChunk(lines.join(lineEnding));
      }

      if (!clientClosed && !res.writableEnded) {
        res.end();
      }
    } finally {
      req.off('close', onClose);
    }
  }

  public async streamPunctualityRawCSV(
    req: Request,
    res: Response,
    params: PunctualityQueryParams = {}
  ): Promise<void> {
    const nowInfo = getISOWeekInfo(new Date());
    const periodType = params.periodType || 'all';
    const yearMonth = params.yearMonth || nowInfo.yearMonth;
    const yearWeek = params.yearWeek || nowInfo.yearWeek;
    const lineFilter = params.line || 'ALL';
    const searchQuery = (params.searchQuery || '').trim();

    const periodTag =
      periodType === 'month'
        ? `Maand_${yearMonth}`
        : periodType === 'week'
        ? `Week_${yearWeek}`
        : `Vanaf_${nowInfo.dateStr}`;

    const headers = [
      'Datum',
      'Maand',
      'ISO_Weeknummer',
      'Tijdstip_Gelogd',
      'Plaats',
      'Haltenaam',
      'DRGL_Haltecode',
      'Lijnnummer',
      'Vervoerder',
      'Bestemming',
      'Rit_ID',
      'Geplande_Tijd',
      'Werkelijke_Tijd',
      'Status',
      'Vertraging_Minuten',
      'Te_Vroeg_Minuten',
    ].join(';');

    const statusNL: Record<string, string> = {
      ontime: 'Op tijd',
      delayed: 'Vertraagd',
      early: 'Te vroeg gepasseerd',
      cancelled: 'Uitgevallen',
    };

    const { whereSql, sqlParams, needsFtsJoin, ftsMatch } = this.buildPunctualityWhere(
      { periodType, yearMonth, yearWeek, line: lineFilter, searchQuery },
      'p'
    );

    let stmt: StatementSync;
    let execParams: (string | number)[];
    if (needsFtsJoin && ftsMatch) {
      const extraCond = whereSql ? whereSql.replace(/^WHERE\s+/i, 'AND ') : '';
      stmt = this.db.prepare(`
        SELECT p.*
        FROM punctuality_fts
        JOIN punctuality_logs p ON p.rowid = punctuality_fts.rowid
        WHERE punctuality_fts MATCH ? ${extraCond}
        ORDER BY p.timestamp DESC, p.id DESC
      `);
      execParams = [ftsMatch, ...sqlParams];
    } else {
      stmt = this.db.prepare(`
        SELECT p.*
        FROM punctuality_logs p
        ${whereSql}
        ORDER BY p.timestamp DESC, p.id DESC
      `);
      execParams = sqlParams;
    }

    await this.streamCursorAsCsv(
      req,
      res,
      `steenwijkerland_vertraging_logboek_${periodTag}.csv`,
      headers,
      '\r\n',
      true,
      stmt,
      execParams,
      (l) => {
        const delay = Number(l.delay_minutes || 0);
        return [
          l.date,
          l.year_month,
          l.year_week,
          l.timestamp,
          l.town,
          l.stop_name,
          l.stop_code,
          l.line,
          l.operator,
          l.destination,
          l.journey_id,
          l.planned_time,
          l.actual_time,
          statusNL[l.status] || l.status,
          delay > 0 ? String(delay).replace('.', ',') : '0',
          delay < 0 ? String(Math.abs(delay)).replace('.', ',') : '0',
        ]
          .map(escapeCsvCellSemicolon)
          .join(';');
      }
    );
  }

  public async streamAansluitingenCSV(
    req: Request,
    res: Response,
    params: AansluitingenQueryParams = {}
  ): Promise<void> {
    const nowInfo = getISOWeekInfo(new Date());
    const period = params.period || 'all';
    const direction = params.direction || 'all';
    const trainType = params.trainType || 'all';
    const lineFilter = params.line || 'all';
    const statusFilter = params.status || 'all';
    const search = (params.search || '').trim();

    const conds: string[] = [];
    const sqlParams: (string | number)[] = [];
    if (period === 'day') {
      conds.push('a.date = ?');
      sqlParams.push(nowInfo.dateStr);
    } else if (period === 'week') {
      conds.push('a.year_week = ?');
      sqlParams.push(nowInfo.yearWeek);
    } else if (period === 'month') {
      conds.push('a.year_month = ?');
      sqlParams.push(nowInfo.yearMonth);
    }
    if (direction !== 'all') {
      conds.push('a.direction = ?');
      sqlParams.push(direction);
    }
    if (trainType !== 'all') {
      conds.push('a.train_type = ?');
      sqlParams.push(trainType);
    }
    if (lineFilter !== 'all') {
      conds.push('a.bus_line = ?');
      sqlParams.push(lineFilter);
    }
    if (statusFilter !== 'all') {
      conds.push('a.status = ?');
      sqlParams.push(statusFilter);
    }

    const ftsMatch = search ? sanitizeFtsQuery(search) : null;
    let stmt: StatementSync;
    let execParams: (string | number)[];
    if (ftsMatch) {
      const extraCond = conds.length > 0 ? `AND ${conds.join(' AND ')}` : '';
      stmt = this.db.prepare(`
        SELECT a.*
        FROM aansluitingen_fts
        JOIN aansluitingen_logs a ON a.rowid = aansluitingen_fts.rowid
        WHERE aansluitingen_fts MATCH ? ${extraCond}
        ORDER BY a.timestamp DESC, a.id DESC
      `);
      execParams = [ftsMatch, ...sqlParams];
    } else {
      const whereSql = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
      stmt = this.db.prepare(`
        SELECT a.*
        FROM aansluitingen_logs a
        ${whereSql}
        ORDER BY a.timestamp DESC, a.id DESC
      `);
      execParams = sqlParams;
    }

    const headers = [
      'Log ID',
      'Datum',
      'Tijdstip',
      'Jaar-Maand',
      'Jaar-Week',
      'Overstap Richting',
      'Trein Soort',
      'Trein Nummer',
      'Trein Richting',
      'Trein Spoor',
      'Buslijn',
      'Bus Vervoerder',
      'Bus Bestemming',
      'Vertrekpunt / Eerste Deel',
      'Geplande Aankomst',
      'Werkelijke Aankomst',
      'Vertraging Aankomst (min)',
      'Aansluitend / Tweede Deel',
      'Gepland Vertrek',
      'Werkelijk Vertrek',
      'Vertraging Vertrek (min)',
      'Geplande Overstaptijd (min)',
      'Gerealiseerde Overstaptijd (min)',
      'Aansluiting Status',
      'Toelichting',
    ].join(',');

    await this.streamCursorAsCsv(
      req,
      res,
      `station_steenwijk_aansluitingen_${direction}_${period}_${nowInfo.dateStr}.csv`,
      headers,
      '\n',
      true,
      stmt,
      execParams,
      (l) => {
        const isBusToTrain = (l.direction || 'bus_naar_trein') === 'bus_naar_trein';
        const dirLabel = isBusToTrain ? 'Bus naar Trein' : 'Trein naar Bus';
        const originLabel = isBusToTrain
          ? `Bus ${l.bus_line} (${l.bus_operator})`
          : `${l.train_type} ${l.train_number}`;
        const connectingLabel = isBusToTrain
          ? `${l.train_type} ${l.train_number} (${l.train_platform})`
          : `Bus ${l.bus_line} (${l.bus_operator})`;

        const plannedArr = isBusToTrain
          ? l.bus_planned_arrival || l.planned_origin_arrival
          : l.train_planned_arrival || l.planned_origin_arrival;
        const actualArr = isBusToTrain
          ? l.bus_actual_arrival || l.actual_origin_arrival
          : l.train_actual_arrival || l.actual_origin_arrival;
        const arrDelay = isBusToTrain ? l.bus_delay_minutes : l.train_delay_minutes;

        const plannedDep = isBusToTrain
          ? l.train_planned_departure || l.planned_connecting_departure
          : l.bus_planned_departure || l.planned_connecting_departure;
        const actualDep = isBusToTrain
          ? l.train_actual_departure || l.actual_connecting_departure
          : l.bus_actual_departure || l.actual_connecting_departure;
        const depDelay = isBusToTrain ? l.train_delay_minutes : l.bus_delay_minutes;

        return [
          l.id,
          l.date,
          l.timestamp,
          l.year_month,
          l.year_week,
          dirLabel,
          l.train_type,
          l.train_number,
          l.train_destination,
          l.train_platform,
          l.bus_line,
          l.bus_operator,
          l.bus_destination,
          originLabel,
          plannedArr,
          actualArr,
          arrDelay,
          connectingLabel,
          plannedDep,
          actualDep,
          depDelay,
          l.planned_transfer_minutes,
          l.realized_transfer_minutes,
          l.status,
          l.notes || '',
        ]
          .map(escapeCsvCellComma)
          .join(',');
      }
    );
  }

  public async streamDeelfietsRawCSV(req: Request, res: Response): Promise<void> {
    const headers = [
      'Tijdstip',
      'Datum',
      'Uurvak',
      'Jaar-Maand',
      'Jaar-Week',
      'Plaats',
      'Deelfietslocatie',
      'Adres',
      'Type Fiets',
      'Capaciteit',
      'Beschikbare Fietsen',
      'Gehuurde Fietsen (Actief)',
      'Nieuwe Verhuringen in Uurvak',
    ].join(';');

    const stmt = this.db.prepare(
      'SELECT * FROM deelfiets_logs ORDER BY timestamp DESC, id DESC'
    );

    await this.streamCursorAsCsv(
      req,
      res,
      'steenwijkerland_deelfietsen_logboek.csv',
      headers,
      '\r\n',
      true,
      stmt,
      [],
      (l) =>
        [
          l.timestamp,
          l.date,
          l.hour_slot,
          l.year_month,
          l.year_week,
          `"${String(l.town || '').replace(/"/g, '""')}"`,
          `"${String(l.location_name || '').replace(/"/g, '""')}"`,
          `"${String(l.street_address || '').replace(/"/g, '""')}"`,
          l.is_cargo_bike ? 'Elektrische Deelbakfiets' : l.electric ? 'Elektrisch' : 'Regulier',
          l.capacity,
          l.available_bikes,
          l.rented_bikes,
          l.new_rentals,
        ].join(';')
    );
  }

  public async streamOvFietsRawCSV(req: Request, res: Response): Promise<void> {
    const headers = [
      'Tijdstip',
      'Datum',
      'Uur',
      'Jaar-Maand',
      'Jaar-Week',
      'Locatiecode',
      'Station',
      'Capaciteit',
      'Beschikbare Fietsen',
      'Gehuurde Fietsen',
      'Nieuwe Verhuringen in Uurvak',
    ].join(';');

    const stmt = this.db.prepare(
      'SELECT * FROM ovfiets_logs ORDER BY timestamp DESC, id DESC'
    );

    await this.streamCursorAsCsv(
      req,
      res,
      'station_steenwijk_ovfiets_logboek.csv',
      headers,
      '\r\n',
      true,
      stmt,
      [],
      (l) =>
        [
          l.timestamp,
          l.date,
          l.hour,
          l.year_month,
          l.year_week,
          l.station_code,
          `"${String(l.name || '').replace(/"/g, '""')}"`,
          l.capacity,
          l.available,
          l.rented,
          l.new_rentals,
        ].join(';')
    );
  }

  public close() {
    this.db.close();
  }
}
