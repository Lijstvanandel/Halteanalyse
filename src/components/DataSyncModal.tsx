import React, { useState } from 'react';
import { BusPosition } from '../types/bus';
import {
  X,
  Radio,
  RefreshCw,
  Server,
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
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Live Data & Synchronisatie Busposities.nl
              </h2>
              <p className="text-xs text-slate-400">
                Actieve geofence: Gemeente Steenwijkerland (52.65°N - 52.88°N)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Status Banner */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white">Actieve Verbinding: {dataSource}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Laatste verversing: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Zojuist'} · Interval: elke 3 sec
              </p>
            </div>

            <button
              onClick={onManualRefresh}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
              <span>Nu Peilen</span>
            </button>
          </div>

          {/* How it works */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>Geofencing Steenwijkerland</span>
            </h3>
            <p className="text-slate-400 leading-relaxed">
              Het systeem peilt actief de busposities van alle bussen binnen de coördinaten van Steenwijkerland:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-center pt-1">
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="text-slate-500 text-[10px]">Noord (North)</div>
                <div className="text-sky-300 font-bold tabular-nums">52.8850° N</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="text-slate-500 text-[10px]">Zuid (South)</div>
                <div className="text-sky-300 font-bold tabular-nums">52.6500° N</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="text-slate-500 text-[10px]">West (West)</div>
                <div className="text-sky-300 font-bold tabular-nums">5.8200° O</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="text-slate-500 text-[10px]">Oost (East)</div>
                <div className="text-sky-300 font-bold tabular-nums">6.2400° O</div>
              </div>
            </div>
          </div>

          {/* Cloudflare Session Bypass Option */}
          <div className="space-y-2 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Busposities.nl Sessie Koppeling</span>
              </h3>
              <a
                href="https://busposities.nl/kaart"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-[11px]"
              >
                <span>busposities.nl/kaart</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Omdat busposities.nl Cloudflare botbeveiliging hanteert voor geautomatiseerde serveroproepen, gebruikt de app automatisch een realtime emulator op basis van het officiële Steenwijkerlandse busnetwerk. Om rechtstreeks met uw eigen busposities.nl browsersessie te peilen, kunt u hier optioneel een sessiecookie opgeven:
            </p>
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Optioneel: cf_clearance of sessie cookie..."
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={saveCookie}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
              >
                Opslaan
              </button>
            </div>
            {cookieSaved && (
              <p className="text-emerald-400 text-[11px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Cookie opgeslagen en geactiveerd in backend proxy!
              </p>
            )}
          </div>

          {/* GeoJSON Payload Inspector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                <span>GeoJSON Telemetrie Stroom (Voorbeeld)</span>
              </h3>
              <button
                onClick={copyPayload}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Gekopieerd!' : 'Kopieer JSON'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-40">
              {JSON.stringify(sampleGeoJSON, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
