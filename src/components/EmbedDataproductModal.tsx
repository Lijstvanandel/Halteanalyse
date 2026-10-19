import React, { useState } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  ExternalLink,
  Maximize2,
  Sparkles,
  Layers,
  Share2,
} from 'lucide-react';

interface EmbedDataproductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmbedDataproductModal: React.FC<EmbedDataproductModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedHeight, setSelectedHeight] = useState('640');
  const [includeBorder, setIncludeBorder] = useState(true);

  if (!isOpen) return null;

  const currentOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-dev-btz3xq4553lxbmqch42qzz-374510427206.europe-west2.run.app';

  const embedUrl = `${currentOrigin}/?embed=true`;

  const iframeSnippet = `<div class="my-8 rounded-xl border border-slate-700/80 bg-slate-900 overflow-hidden shadow-lg">
  <div class="bg-slate-800/90 border-b border-slate-700/80 px-4 py-2.5 flex items-center justify-between gap-3">
    <div class="flex items-center gap-2.5 min-w-0">
      <div class="w-7 h-7 rounded-lg bg-[#FFCC00]/20 text-[#FFCC00] flex items-center justify-center font-black text-xs">
        LA
      </div>
      <div class="min-w-0">
        <h4 class="text-xs sm:text-sm font-bold text-white truncate">Actuele Busposities & Deelfietsen Steenwijkerland</h4>
        <p class="text-[10px] text-slate-300 truncate">Dataproduct van Lijst van Andel</p>
      </div>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <a href="${embedUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#FFCC00] text-slate-950 hover:bg-amber-300 transition-colors">
        <span>Openen</span>
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
      </a>
    </div>
  </div>
  <iframe
    src="${embedUrl}"
    width="100%"
    height="${selectedHeight}"
    style="border:0; width:100%; height:${selectedHeight}px; display:block;"
    title="Actuele Busposities & Deelfietsen Steenwijkerland — Dataproduct van Lijst van Andel"
    loading="lazy"
    allow="geolocation"
    allowfullscreen
  ></iframe>
  <div class="bg-slate-900/90 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
    <span class="font-semibold text-[#FFCC00]">Dataproduct van Lijst van Andel</span>
    <span>Realtime OV-data Gemeente Steenwijkerland</span>
  </div>
</div>`;

  const simpleIframeSnippet = `<iframe src="${embedUrl}" width="100%" height="${selectedHeight}" style="border:${
    includeBorder ? '1px solid rgba(255,255,255,0.15)' : '0'
  }; border-radius:12px; overflow:hidden;" title="Actuele Busposities Steenwijkerland — Dataproduct van Lijst van Andel" allow="geolocation" allowfullscreen></iframe>`;

  const handleCopy = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0E518D] border-b border-[#0A3D6B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFCC00] text-[#0E518D] flex items-center justify-center font-black shadow-md">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Dataproduct Insluiten in Nieuwsbericht
              </h2>
              <p className="text-xs text-blue-200">
                Lijst van Andel • Responsive HTML/Iframe embed voor swl.scientiarum.nl en nieuwswebsites
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FFCC00]" />
                Instellingen voor weergave in artikelen
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Hoogte:</span>
                {['500', '640', '780'].map((h) => (
                  <button
                    key={h}
                    onClick={() => setSelectedHeight(h)}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                      selectedHeight === h
                        ? 'bg-[#FFCC00] text-slate-950 shadow-sm'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    {h}px {h === '640' ? '(Standaard)' : ''}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Dit dataproduct is geoptimaliseerd voor insluiting in artikelen op{' '}
              <span className="text-[#FFCC00] font-mono">swl.scientiarum.nl</span> en{' '}
              <span className="text-[#FFCC00] font-mono">lijstvanandel.nl</span>. Het schaalt automatisch
              mee met mobiel, tablet en desktop en toont onderin altijd de officiële bronvermelding:{' '}
              <strong className="text-white">Dataproduct van Lijst van Andel</strong>.
            </p>
          </div>

          {/* Option 1: Full Article Card (as seen on swl.scientiarum.nl) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>1. Compleet artikel-dataproduct (Aanbevolen)</span>
              </label>
              <button
                onClick={() => handleCopy(iframeSnippet)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCC00] hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer transition-all shadow-md active:scale-98"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-800" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Gekopieerd!' : 'Kopieer HTML-kaart'}</span>
              </button>
            </div>
            <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto max-h-36 select-all">
              {iframeSnippet}
            </pre>
          </div>

          {/* Option 2: Compact Direct Iframe */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                2. Enkele Iframe-tag (Compact)
              </label>
              <button
                onClick={() => handleCopy(simpleIframeSnippet)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Kopieer Iframe</span>
              </button>
            </div>
            <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto max-h-24 select-all">
              {simpleIframeSnippet}
            </pre>
          </div>

          {/* Direct Link Preview */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-400">
              Directe insluit-URL: <span className="text-white font-mono">{embedUrl}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test weergave</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Dataproduct van Lijst van Andel • Steenwijkerland</span>
          <button
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
