import React, { useState } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
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
  const [includeBorder] = useState(true);

  if (!isOpen) return null;

  const currentOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-dev-btz3xq4553lxbmqch42qzz-374510427206.europe-west2.run.app';

  const embedUrl = `${currentOrigin}/?embed=true`;

  const iframeSnippet = `<div style="margin:2rem 0;border-radius:5px;border:1px solid #1b3829;background:#0b1a13;overflow:hidden;font-family:'Inter',-apple-system,sans-serif;font-variant-numeric:tabular-nums;">
  <div style="background:#162f23;border-bottom:1px solid #1b3829;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
    <div style="display:flex;align-items:center;gap:10px;min-width:0;">
      <div style="width:28px;height:28px;border-radius:4px;background:#f59e0b;color:#060e0a;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">
        LA
      </div>
      <div style="min-width:0;">
        <h4 style="margin:0;font-size:13px;font-weight:700;color:#f5f6f4;">Actuele Busposities &amp; Deelfietsen Steenwijkerland</h4>
        <p style="margin:0;font-size:11px;color:#9bb0a4;">Dataproduct van Lijst van Andel</p>
      </div>
    </div>
    <a href="${embedUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;font-size:12px;font-weight:700;border-radius:4px;background:#f59e0b;color:#060e0a;text-decoration:none;">
      Openen
    </a>
  </div>
  <iframe
    src="${embedUrl}"
    width="100%"
    height="${selectedHeight}"
    style="border:0;width:100%;height:${selectedHeight}px;display:block;"
    title="Actuele Busposities &amp; Deelfietsen Steenwijkerland — Dataproduct van Lijst van Andel"
    loading="lazy"
    allow="geolocation"
    allowfullscreen
  ></iframe>
  <div style="background:#060e0a;border-top:1px solid #1b3829;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#60756a;">
    <span style="font-weight:600;color:#f59e0b;">Dataproduct van Lijst van Andel</span>
    <span>Realtime OV-data Gemeente Steenwijkerland</span>
  </div>
</div>`;

  const simpleIframeSnippet = `<iframe src="${embedUrl}" width="100%" height="${selectedHeight}" style="border:${
    includeBorder ? '1px solid #1b3829' : '0'
  }; border-radius:5px; overflow:hidden;" title="Actuele Busposities Steenwijkerland — Dataproduct van Lijst van Andel" allow="geolocation" allowfullscreen></iframe>`;

  const handleCopy = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-[#060e0a]/85 backdrop-blur-xs p-4 animate-in fade-in duration-200 tabular-nums"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] rounded-[6px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[4px] bg-[var(--accent-gold)] text-[#060e0a] flex items-center justify-center font-bold">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)] tracking-tight">
                Dataproduct Insluiten in Nieuwsbericht
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Lijst van Andel · Responsive HTML/Iframe embed voor swl.scientiarum.nl en nieuwswebsites
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
            title="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          <div className="bg-[var(--bg-main)] border border-[var(--border-subtle)] p-4 rounded-[5px] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-[var(--text-main)] flex items-center gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-[var(--accent-gold)]" />
                Instellingen voor weergave in artikelen
              </span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[var(--text-muted)]">Hoogte:</span>
                {['500', '640', '780'].map((h) => (
                  <button
                    key={h}
                    onClick={() => setSelectedHeight(h)}
                    className={`px-2.5 py-1 rounded-[4px] font-semibold cursor-pointer transition-colors border tabular-nums ${
                      selectedHeight === h
                        ? 'bg-[var(--accent-gold)] text-[#060e0a] border-[var(--accent-gold-bright)]'
                        : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {h}px {h === '640' ? '(Standaard)' : ''}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Dit dataproduct is geoptimaliseerd voor insluiting in artikelen op{' '}
              <span className="text-[var(--accent-gold-bright)] font-mono">swl.scientiarum.nl</span> en{' '}
              <span className="text-[var(--accent-gold-bright)] font-mono">lijstvanandel.nl</span>. Het schaalt automatisch
              mee met mobiel, tablet en desktop en toont onderin altijd de officiële bronvermelding:{' '}
              <strong className="text-[var(--text-main)]">Dataproduct van Lijst van Andel</strong>.
            </p>
          </div>

          {/* Option 1: Full Article Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                <span>1. Compleet artikel-dataproduct (Aanbevolen)</span>
              </label>
              <button
                onClick={() => handleCopy(iframeSnippet)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] font-bold text-xs cursor-pointer transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Gekopieerd!' : 'Kopieer HTML-kaart'}</span>
              </button>
            </div>
            <pre className="p-3.5 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] font-mono text-[11px] text-[var(--text-muted)] overflow-x-auto max-h-36 select-all">
              {iframeSnippet}
            </pre>
          </div>

          {/* Option 2: Compact Direct Iframe */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                2. Enkele Iframe-tag (Compact)
              </label>
              <button
                onClick={() => handleCopy(simpleIframeSnippet)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] font-semibold text-xs border border-[var(--border-subtle)] cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[var(--status-emerald)]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Kopieer Iframe</span>
              </button>
            </div>
            <pre className="p-3.5 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-[5px] font-mono text-[11px] text-[var(--text-muted)] overflow-x-auto max-h-24 select-all">
              {simpleIframeSnippet}
            </pre>
          </div>

          {/* Direct Link Preview */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-[var(--text-muted)]">
              Directe insluit-URL: <span className="text-[var(--text-main)] font-mono">{embedUrl}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span>Test weergave</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[var(--bg-main)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-dim)] shrink-0">
          <span>Dataproduct van Lijst van Andel · Steenwijkerland</span>
          <button
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
