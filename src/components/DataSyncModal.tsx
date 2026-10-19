import React, { useState } from 'react';
import { BusPosition } from '../types/bus';
import {
  X,
  Radio,
  RefreshCw,
  Globe,
  Code,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { STEENWIJKERLAND_BOUNDS } from '../data/steenwijkerland';

interface DataSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataSource: string;
  isSyncing: boolean;
  onManualRefresh: () => void;
  buses: BusPosition[];
  lastSyncTime: Date | null;
}

export const DataSyncModal: React.FC<DataSyncModalProps> = ({
  isOpen,
  onClose,
  dataSource,
  isSyncing,
  onManualRefresh,
  buses,
  lastSyncTime,
}) => {
  const [cookieInput, setCookieInput] = useState('');
  const [cookieSaved, setCookieSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const saveCookie = async () => {
    try {
      await fetch('/api/config/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookieInput }),
      });
      setCookieSaved(true);
      setTimeout(() => setCookieSaved(false), 3000);
      onManualRefresh();
    } catch (err) {
      console.error('Fout bij opslaan cookie:', err);
    }
  };

  const sampleGeoJSON = {
    type: 'FeatureCollection',
    source: dataSource,
    query_bounds: {
      gemeente: 'Steenwijkerland',
      north: STEENWIJKERLAND_BOUNDS.north,
      south: STEENWIJKERLAND_BOUNDS.south,
      east: STEENWIJKERLAND_BOUNDS.east,
      west: STEENWIJKERLAND_BOUNDS.west,
    },
    count: buses.length,
    features: buses.slice(0, 2).map((b) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [b.lat, b.lng],
      },
      properties: {
        matnummer: b.matnummer,
        color: b.color,
        richting: b.heading,
        lijn: b.line,
        vervoerder: b.operatorName,
        bestemming: b.destination,
        snelheid: b.speedKmH,
      },
    })),
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(sampleGeoJSON, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-[#060e0a]/85 backdrop-blur-xs animate-in fade-in duration-200 tabular-nums">
      <div className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[6px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[4px] bg-[var(--bg-main)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--status-emerald)]">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)] tracking-tight">
                Live Data &amp; Synchronisatie Busposities.nl
              </h2>
              <p className="text-xs text-[var(--text-muted)] tabular-nums">
                Actieve geofence: Gemeente Steenwijkerland (52.65°N - 52.88°N)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-[var(--text-muted)]">
          {/* Status Banner */}
          <div className="p-4 rounded-[5px] bg-[var(--bg-main)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--status-emerald)]" />
                <span className="font-semibold text-[var(--text-main)]">Actieve Verbinding: {dataSource}</span>
              </div>
              <p className="text-[11px] text-[var(--text-dim)] tabular-nums">
                Laatste verversing: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Zojuist'} · Interval: elke 3 sec
              </p>
            </div>

            <button
              onClick={onManualRefresh}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[var(--accent-gold)]' : ''}`} />
              <span>Nu Peilen</span>
            </button>
          </div>

          {/* How it works */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[var(--status-blue)]" />
              <span>Geofencing Steenwijkerland</span>
            </h3>
            <p className="text-[var(--text-muted)] leading-relaxed">
              Het systeem peilt actief de busposities van alle bussen binnen de coördinaten van Steenwijkerland:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-center pt-1 tabular-nums">
              <div className="p-2 rounded-[4px] bg-[var(--bg-main)] border border-[var(--border-subtle)]">
                <div className="text-[var(--text-dim)] text-[10px]">Noord (North)</div>
                <div className="text-[var(--status-blue)] font-bold tabular-nums">52.8850° N</div>
              </div>
              <div className="p-2 rounded-[4px] bg-[var(--bg-main)] border border-[var(--border-subtle)]">
                <div className="text-[var(--text-dim)] text-[10px]">Zuid (South)</div>
                <div className="text-[var(--status-blue)] font-bold tabular-nums">52.6500° N</div>
              </div>
              <div className="p-2 rounded-[4px] bg-[var(--bg-main)] border border-[var(--border-subtle)]">
                <div className="text-[var(--text-dim)] text-[10px]">West (West)</div>
                <div className="text-[var(--status-blue)] font-bold tabular-nums">5.8200° O</div>
              </div>
              <div className="p-2 rounded-[4px] bg-[var(--bg-main)] border border-[var(--border-subtle)]">
                <div className="text-[var(--text-dim)] text-[10px]">Oost (East)</div>
                <div className="text-[var(--status-blue)] font-bold tabular-nums">6.2400° O</div>
              </div>
            </div>
          </div>

          {/* Cloudflare Session Bypass Option */}
          <div className="space-y-2 p-4 rounded-[5px] bg-[var(--bg-main)] border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span>Busposities.nl Sessie Koppeling</span>
              </h3>
              <a
                href="https://busposities.nl/kaart"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--status-blue)] hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>busposities.nl/kaart</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
              Omdat busposities.nl Cloudflare botbeveiliging hanteert voor geautomatiseerde serveroproepen, gebruikt de app automatisch een realtime emulator op basis van het officiële Steenwijkerlandse busnetwerk. Om rechtstreeks met uw eigen busposities.nl browsersessie te peilen, kunt u hier optioneel een sessiecookie opgeven:
            </p>
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Optioneel: cf_clearance of sessie cookie..."
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                className="flex-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[4px] px-3 py-1.5 text-xs text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-focus)]"
              />
              <button
                onClick={saveCookie}
                className="px-3 py-1.5 bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] font-bold rounded-[4px] transition-colors cursor-pointer"
              >
                Opslaan
              </button>
            </div>
            {cookieSaved && (
              <p className="text-[var(--status-emerald)] text-[11px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Cookie opgeslagen en geactiveerd in backend proxy!
              </p>
            )}
          </div>

          {/* GeoJSON Payload Inspector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-[var(--status-purple)]" />
                <span>GeoJSON Telemetrie Stroom (Voorbeeld)</span>
              </h3>
              <button
                onClick={copyPayload}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Gekopieerd!' : 'Kopieer JSON'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[var(--bg-main)] rounded-[5px] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)] overflow-x-auto max-h-40">
              {JSON.stringify(sampleGeoJSON, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-main)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] rounded-[4px] text-xs font-semibold transition-colors cursor-pointer"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
