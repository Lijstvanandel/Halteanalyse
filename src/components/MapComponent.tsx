import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { BusPosition, BusStop } from '../types/bus';
import {
  STEENWIJKERLAND_BOUNDS,
  STEENWIJKERLAND_POLYGON,
  STEENWIJKERLAND_STOPS,
  BUS_ROUTES,
  ROUTE_MAP_BADGES,
  LineRoute,
  isPointInSteenwijkerland,
} from '../data/steenwijkerland';
import {
  PunctualityLogEntry,
  getISOWeekInfo,
} from '../utils/punctuality';
import {
  DeelfietsLocation,
  DeelfietsLogEntry,
  aggregateDeelfietsStats,
} from '../utils/deelfiets';
import {
  createBusMarkerIcon,
  createHalteIcon,
  createGpsLocationIcon,
  createDeelfietsIcon,
} from '../utils/markerIcons';
import {
  Crosshair,
  Layers,
  MapPin,
  Eye,
  EyeOff,
  Navigation,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Bike,
} from 'lucide-react';

interface MapComponentProps {
  buses: BusPosition[];
  selectedBus: BusPosition | null;
  onSelectBus: (bus: BusPosition | null) => void;
  onSelectStop?: (stop: BusStop) => void;
  onOpenStopStats?: (stop: BusStop) => void;
  punctualityLogs?: PunctualityLogEntry[];
  deelfietsLocations?: DeelfietsLocation[];
  deelfietsLogs?: DeelfietsLogEntry[];
  showDeelfietsen?: boolean;
  onToggleDeelfietsen?: (show: boolean) => void;
  onOpenDeelfietsStats?: (location: DeelfietsLocation) => void;
  showHaltes: boolean;
  onToggleHaltes: (show: boolean) => void;
  showRoutes: boolean;
  onToggleRoutes: (show: boolean) => void;
  followedBusId: string | null;
  onStopFollowBus: () => void;
  activeJourneyPolyline?: [number, number][];
}

// Strictly NO carto.com or cartocdn.com
type TileLayerKey = 'osm' | 'opentopo' | 'satellite';

const TILE_LAYERS: Record<TileLayerKey, { name: string; url: string; attribution: string; maxZoom: number }> = {
  osm: {
    name: 'OpenStreetMap (Standaard DRGL)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  opentopo: {
    name: 'OpenTopoMap (Topografie)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
    maxZoom: 17,
  },
  satellite: {
    name: 'Luchtfoto / Satelliet (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; Earthstar Geographics',
    maxZoom: 18,
  },
};

export const MapComponent: React.FC<MapComponentProps> = ({
  buses,
  selectedBus,
  onSelectBus,
  onSelectStop,
  onOpenStopStats,
  punctualityLogs = [],
  deelfietsLocations = [],
  deelfietsLogs = [],
  showDeelfietsen = true,
  onToggleDeelfietsen,
  onOpenDeelfietsStats,
  showHaltes,
  onToggleHaltes,
  showRoutes,
  onToggleRoutes,
  followedBusId,
  onStopFollowBus,
  activeJourneyPolyline,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const haltesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const deelfietsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const journeyPolylineLayerRef = useRef<L.Polyline | null>(null);
  const userGpsMarkerRef = useRef<L.Marker | null>(null);
  const municipalityOutlineRef = useRef<L.Polygon | null>(null);

  const [activeTileLayer, setActiveTileLayer] = useState<TileLayerKey>('osm');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isFollowingUserGps, setIsFollowingUserGps] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(STEENWIJKERLAND_BOUNDS.defaultZoom);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const lastSelectedBusIdRef = useRef<string | null>(null);

  // Initialize Leaflet Map with pitch-black exterior mask outside Gemeente Steenwijkerland
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [STEENWIJKERLAND_BOUNDS.center.lat, STEENWIJKERLAND_BOUNDS.center.lng],
      zoom: STEENWIJKERLAND_BOUNDS.defaultZoom,
      minZoom: 8,
      maxZoom: 19,
      zoomControl: false,
    });

    mapInstanceRef.current = map;

    // Create custom pane for the pitch-black mask outside the municipality border
    // zIndex 450 sits above tilePane (200) and overlayPane (400), masking all map tiles and routes outside Steenwijkerland
    const maskPane = map.createPane('exteriorBlackMaskPane');
    maskPane.style.zIndex = '450';
    maskPane.style.pointerEvents = 'none';

    // Tile layer (OpenStreetMap)
    const tileConfig = TILE_LAYERS[activeTileLayer];
    const tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);
    currentTileLayerRef.current = tileLayer;

    // Inverted world polygon with hole = STEENWIJKERLAND_POLYGON (3,782 exact vertices)
    // Everything outside the municipal border is rendered 100% solid black (#000000)
    const outerWorldRing: [number, number][] = [
      [-90, -180],
      [-90, 180],
      [90, 180],
      [90, -180],
    ];

    L.polygon([outerWorldRing, STEENWIJKERLAND_POLYGON], {
      pane: 'exteriorBlackMaskPane',
      stroke: true,
      color: '#0E518D',
      weight: 2.5,
      opacity: 1,
      fillColor: '#000000',
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);

    // Invisible reference polygon of Steenwijkerland for fitBounds
    const municipalityOutline = L.polygon(STEENWIJKERLAND_POLYGON, {
      stroke: false,
      fill: false,
      interactive: false,
    }).addTo(map);
    municipalityOutlineRef.current = municipalityOutline;

    // Layer groups for routes, haltes, and deelfietsen
    routesLayerGroupRef.current = L.layerGroup().addTo(map);
    haltesLayerGroupRef.current = L.layerGroup().addTo(map);
    deelfietsLayerGroupRef.current = L.layerGroup().addTo(map);

    try {
      const bounds = municipalityOutline.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch {
      // ignore
    }

    // Zoom listener
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Automatically invalidate map size when left/right sidebars open or close
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    if (mapContainerRef.current) {
      ro.observe(mapContainerRef.current);
    }

    return () => {
      ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer (Switching strictly between OSM / OpenTopo / Esri)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const tileConfig = TILE_LAYERS[activeTileLayer];
    const newTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    currentTileLayerRef.current = newTileLayer;
  }, [activeTileLayer]);

  // Active Journey Polyline (DRGL Style: #0E518D, width 6)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (journeyPolylineLayerRef.current) {
      map.removeLayer(journeyPolylineLayerRef.current);
      journeyPolylineLayerRef.current = null;
    }

    if (activeJourneyPolyline && activeJourneyPolyline.length > 0) {
      const clipped = activeJourneyPolyline.filter(([lat, lng]) =>
        isPointInSteenwijkerland(lat, lng)
      );
      const ptsToDraw = clipped.length >= 2 ? clipped : activeJourneyPolyline;

      const poly = L.polyline(ptsToDraw, {
        color: '#0E518D',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      journeyPolylineLayerRef.current = poly;
      map.fitBounds(poly.getBounds(), { padding: [50, 50] });
    }
  }, [activeJourneyPolyline]);

  // Draw Routes Network + On-Map Line Badges (strictly inside Steenwijkerland)
  useEffect(() => {
    if (!routesLayerGroupRef.current) return;
    const layer = routesLayerGroupRef.current;
    layer.clearLayers();

    if (!showRoutes) return;

    BUS_ROUTES.forEach((route: LineRoute) => {
      const polyline = L.polyline(route.path, {
        color: route.color,
        weight: route.line === '26' ? 4.5 : 4,
        opacity: 0.82,
        lineCap: 'round',
        lineJoin: 'round',
      });

      polyline.bindTooltip(
        `<div class="font-sans text-xs"><strong>Lijn ${route.line} (${route.operator})</strong><br/>${route.name}</div>`,
        {
          sticky: true,
          className: 'route-tooltip',
        }
      );

      polyline.bindPopup(
        `<div class="p-2 font-sans text-xs text-slate-900">
          <div class="flex items-center gap-2 mb-1">
            <span style="background:${route.color};color:#fff;padding:2px 7px;border-radius:4px;font-weight:bold;">Lijn ${route.line}</span>
            <span class="font-semibold text-slate-600">${route.operator}</span>
          </div>
          <div class="font-bold text-slate-900">${route.name}</div>
        </div>`
      );

      layer.addLayer(polyline);
    });

    // Only draw route badges that lie strictly inside Gemeente Steenwijkerland
    ROUTE_MAP_BADGES.filter((b) => isPointInSteenwijkerland(b.lat, b.lng)).forEach((badge) => {
      const badgeIcon = L.divIcon({
        className: 'route-map-badge-icon',
        html: `<div style="background:${badge.color};color:#ffffff;padding:2px 6px;border-radius:5px;font-size:10px;font-weight:800;white-space:nowrap;border:1.5px solid #ffffff;box-shadow:0 2px 5px rgba(0,0,0,0.35);font-family:sans-serif;letter-spacing:0.01em;">${badge.label}</div>`,
        iconSize: [96, 20],
        iconAnchor: [48, 10],
      });

      const badgeMarker = L.marker([badge.lat, badge.lng], {
        icon: badgeIcon,
        interactive: true,
      });

      badgeMarker.bindPopup(
        `<div class="p-2 font-sans text-xs text-slate-900">
          <div class="flex items-center gap-2 mb-1">
            <span style="background:${badge.color};color:#fff;padding:2px 7px;border-radius:4px;font-weight:bold;">Lijn ${badge.line}</span>
          </div>
          <div class="font-bold text-slate-900">${badge.subtitle}</div>
        </div>`
      );

      layer.addLayer(badgeMarker);
    });
  }, [showRoutes]);

  // Draw Exact 186 Bus Stops from bestandkaart.html (with Plaats, Haltenaam & live Punctuality Stats)
  useEffect(() => {
    if (!haltesLayerGroupRef.current) return;
    const layer = haltesLayerGroupRef.current;
    layer.clearLayers();

    if (!showHaltes) return;

    STEENWIJKERLAND_STOPS.forEach((stop: BusStop) => {
      const marker = L.marker([stop.lat, stop.lng], {
        icon: createHalteIcon(),
      });

      // Compute punctuality stats for this stop from punctualityLogs
      const stopLogs = punctualityLogs.filter(
        (l) => l.town === stop.town && l.stopName === stop.name
      );
      const totalTrips = stopLogs.length;
      const cancelledTrips = stopLogs.filter((l) => l.status === 'cancelled').length;
      const operatedTrips = stopLogs.filter((l) => l.status !== 'cancelled');
      const delayedTrips = operatedTrips.filter((l) => l.status === 'delayed' || l.delayMinutes > 0);
      const earlyTrips = operatedTrips.filter((l) => l.status === 'early' || l.delayMinutes < 0);

      const avgDelayMin =
        delayedTrips.length > 0
          ? (
              delayedTrips.reduce((a, b) => a + Math.max(0, b.delayMinutes), 0) /
              delayedTrips.length
            ).toFixed(1)
          : '0.0';

      const avgEarlyMin =
        earlyTrips.length > 0
          ? (
              earlyTrips.reduce((a, b) => a + Math.abs(Math.min(0, b.delayMinutes)), 0) /
              earlyTrips.length
            ).toFixed(1)
          : '0.0';

      marker.bindTooltip(
        `<div class="font-sans text-xs">
          <strong>${stop.town} — Halte ${stop.name}</strong><br/>
          <span class="text-slate-600">Lijnen: ${stop.lines.join(', ')}</span><br/>
          <span class="text-[10px] text-slate-500">Uitval: ${cancelledTrips} • Gem. vertraging: +${avgDelayMin}m • Te vroeg: ${earlyTrips.length}x (-${avgEarlyMin}m)</span>
        </div>`,
        {
          direction: 'top',
          offset: [0, -8],
        }
      );

      const routeListHtml =
        stop.routeDetails && stop.routeDetails.length > 0
          ? stop.routeDetails
              .map(
                (r) =>
                  `<div style="margin-bottom:4px;font-size:11.5px;line-height:1.35;display:flex;align-items:flex-start;gap:6px;">
                    <span style="background:${r.color};color:#fff;padding:1px 6px;border-radius:3px;font-weight:bold;font-size:10.5px;flex-shrink:0;">${r.line}</span>
                    <span style="color:#1e293b;">${r.description}</span>
                  </div>`
              )
              .join('')
          : stop.lines
              .map(
                (l) =>
                  `<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-300 mr-1">${l}</span>`
              )
              .join('');

      const popupContainer = document.createElement('div');
      popupContainer.className = 'p-2.5 text-slate-900 min-w-[265px] max-w-[320px] font-sans';
      popupContainer.innerHTML = `
        <div class="flex items-center gap-2 pb-1.5 mb-2 border-b border-slate-200">
          <span class="w-5 h-5 rounded-full bg-[#0E518D] text-[10px] font-bold text-[#FFCC00] flex items-center justify-center shrink-0">H</span>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-[#0E518D] uppercase tracking-wider">Bushalte Steenwijkerland</div>
            <div class="text-sm font-bold text-slate-900 leading-tight">${stop.town} — ${stop.name}</div>
          </div>
        </div>
        <div class="bg-slate-50 rounded-lg p-2 mb-2 border border-slate-200 text-xs space-y-1">
          <div class="flex justify-between gap-2">
            <span class="text-slate-500 font-medium">Plaats:</span>
            <span class="font-bold text-slate-900 text-right">${stop.town}</span>
          </div>
          <div class="flex justify-between gap-2">
            <span class="text-slate-500 font-medium">Haltenaam:</span>
            <span class="font-bold text-[#0E518D] text-right">${stop.name}</span>
          </div>
        </div>
        <div class="bg-blue-50/70 rounded-lg p-2 mb-2 border border-blue-200 text-[11px] space-y-1">
          <div class="font-bold text-[#0E518D] uppercase tracking-wider text-[10px]">
            Halte Stiptheid & Vertraging (${totalTrips} gelogde ritten)
          </div>
          <div class="flex justify-between">
            <span class="text-slate-600">Uitgevallen ritten:</span>
            <span class="font-mono font-bold text-red-700">${cancelledTrips} ritten</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-600">Gemiddelde vertraging:</span>
            <span class="font-mono font-bold text-amber-800">+${avgDelayMin} min (${delayedTrips.length}x te laat)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-600">Te vroeg gepasseerd:</span>
            <span class="font-mono font-bold text-sky-800">${earlyTrips.length}x (gem. -${avgEarlyMin} min)</span>
          </div>
        </div>
        <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Bediende Lijnen & Richtingen:
        </div>
        <div class="max-h-28 overflow-y-auto pr-1 mb-2">
          ${routeListHtml}
        </div>
        <div class="flex flex-col gap-1.5">
          <button
            type="button"
            class="drgl-stop-btn w-full py-1.5 px-2.5 rounded-lg bg-[#0E518D] hover:bg-[#0A3D6B] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Toon Vertrektijden (${stop.town}, ${stop.name})</span>
          </button>
          <button
            type="button"
            class="drgl-stats-btn w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Maand- & Weekstatistieken (.CSV)</span>
          </button>
        </div>
      `;

      const btn = popupContainer.querySelector('.drgl-stop-btn');
      if (btn && onSelectStop) {
        btn.addEventListener('click', () => {
          onSelectStop(stop);
        });
      }

      const statsBtn = popupContainer.querySelector('.drgl-stats-btn');
      if (statsBtn && onOpenStopStats) {
        statsBtn.addEventListener('click', () => {
          onOpenStopStats(stop);
        });
      }

      marker.bindPopup(popupContainer);
      layer.addLayer(marker);
    });
  }, [showHaltes, onSelectStop, onOpenStopStats, punctualityLogs]);

  // Draw 17 Deelfiets Nederland Hubs in Gemeente Steenwijkerland with Day/Week/Month stats
  useEffect(() => {
    if (!deelfietsLayerGroupRef.current) return;
    const layer = deelfietsLayerGroupRef.current;
    layer.clearLayers();

    if (!showDeelfietsen || deelfietsLocations.length === 0) return;

    const nowInfo = getISOWeekInfo(new Date());
    const statsList = aggregateDeelfietsStats(
      deelfietsLocations,
      deelfietsLogs,
      nowInfo.dateStr,
      nowInfo.yearWeek,
      nowInfo.yearMonth,
      'day'
    );
    const statsById = new Map(statsList.map((s) => [s.stationId, s]));

    deelfietsLocations.forEach((loc) => {
      if (!isPointInSteenwijkerland(loc.lat, loc.lng)) return;

      const marker = L.marker([loc.lat, loc.lng], {
        icon: createDeelfietsIcon(loc.available, loc.capacity, loc.isCargoBike),
      });

      const st = statsById.get(loc.stationId);

      marker.bindTooltip(
        `<div class="font-sans text-xs">
          <strong>Deelfiets: ${loc.town} — ${loc.name}</strong><br/>
          <span class="text-slate-600">${loc.streetAddress} • ${
          loc.isCargoBike ? 'Elektrische Deelbakfiets' : 'Elektrische Deelfiets'
        }</span><br/>
          <span class="text-[10px] font-semibold text-sky-700">Nu beschikbaar: ${loc.available}/${
          loc.capacity
        } (Gehuurd: ${loc.rented})</span>
        </div>`,
        {
          direction: 'top',
          offset: [0, -14],
        }
      );

      const popupContainer = document.createElement('div');
      popupContainer.className = 'p-2.5 text-slate-900 min-w-[275px] max-w-[330px] font-sans';
      popupContainer.innerHTML = `
        <div class="flex items-center gap-2 pb-1.5 mb-2 border-b border-slate-200">
          <span class="w-6 h-6 rounded-full bg-[#00B1FF] text-[11px] font-bold text-white flex items-center justify-center shrink-0">🚲</span>
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-[#0086d6] uppercase tracking-wider">Deelfiets Nederland • ${loc.town}</div>
            <div class="text-sm font-bold text-slate-900 leading-tight">${loc.name}</div>
          </div>
        </div>
        <div class="bg-slate-50 rounded-lg p-2 mb-2 border border-slate-200 text-xs space-y-1">
          <div class="flex justify-between gap-2">
            <span class="text-slate-500 font-medium">Adres:</span>
            <span class="font-bold text-slate-900 text-right">${loc.streetAddress}, ${loc.town}</span>
          </div>
          <div class="flex justify-between gap-2">
            <span class="text-slate-500 font-medium">Type:</span>
            <span class="font-bold text-[#0086d6] text-right">${
              loc.isCargoBike ? 'Elektrische Deelbakfiets' : 'Elektrisch'
            }</span>
          </div>
          <div class="flex justify-between gap-2">
            <span class="text-slate-500 font-medium">Nu beschikbaar / gehuurd:</span>
            <span class="font-mono font-bold text-emerald-700 text-right">${loc.available} beschikbaar • ${loc.rented} gehuurd (cap. ${loc.capacity})</span>
          </div>
          <div class="flex justify-between gap-2 text-[11px]">
            <span class="text-slate-500">Tarief:</span>
            <span class="text-slate-700 text-right">€${loc.pricing.startTariff.toFixed(2).replace('.', ',')} start • €${loc.pricing.per15Min.toFixed(2).replace('.', ',')}/15m • €${loc.pricing.perDay}/dag</span>
          </div>
        </div>
        ${
          st
            ? `<div class="bg-sky-50/80 rounded-lg p-2 mb-2 border border-sky-200 text-[11px] space-y-1">
                <div class="font-bold text-[#0086d6] uppercase tracking-wider text-[10px]">
                  Statistieken (Dag / Week / Maand)
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-600">Gem. beschikbare fietsen:</span>
                  <span class="font-mono font-bold text-sky-900">D: ${st.avgAvailableDay} | W: ${st.avgAvailableWeek} | M: ${st.avgAvailableMonth}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-600">Gem. gehuurde fietsen:</span>
                  <span class="font-mono font-bold text-amber-800">D: ${st.avgRentedDay} | W: ${st.avgRentedWeek} | M: ${st.avgRentedMonth}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-600">Totaal gehuurde fietsen:</span>
                  <span class="font-mono font-bold text-emerald-800">D: ${st.totalRentedDay} | W: ${st.totalRentedWeek} | M: ${st.totalRentedMonth}</span>
                </div>
              </div>`
            : ''
        }
        <button
          type="button"
          class="deelfiets-stats-btn w-full py-1.5 px-2.5 rounded-lg bg-[#0086d6] hover:bg-sky-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Open Deelfiets Statistieken & .CSV</span>
        </button>
      `;

      const statsBtn = popupContainer.querySelector('.deelfiets-stats-btn');
      if (statsBtn && onOpenDeelfietsStats) {
        statsBtn.addEventListener('click', () => {
          onOpenDeelfietsStats(loc);
        });
      }

      marker.bindPopup(popupContainer);
      layer.addLayer(marker);
    });
  }, [showDeelfietsen, deelfietsLocations, deelfietsLogs, onOpenDeelfietsStats]);

  // Update Bus Markers (DRGL Style #ffcc00 + #0e518d, strictly inside Steenwijkerland)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentMarkerMap = busMarkersRef.current;
    const visibleBuses = buses.filter((b) => isPointInSteenwijkerland(b.lat, b.lng));
    const activeIds = new Set(visibleBuses.map((b) => b.id));

    // Remove obsolete
    for (const [id, marker] of currentMarkerMap.entries()) {
      if (!activeIds.has(id)) {
        map.removeLayer(marker);
        currentMarkerMap.delete(id);
      }
    }

    // Add or update
    visibleBuses.forEach((bus) => {
      const isSelected = selectedBus?.id === bus.id;
      const icon = createBusMarkerIcon(bus, isSelected);
      const delayText =
        bus.delayMinutes > 0
          ? `<span style="color:#dc2626;font-weight:bold;">+${bus.delayMinutes} min later</span>`
          : bus.delayMinutes < 0
          ? `<span style="color:#0284c7;font-weight:bold;">${bus.delayMinutes} min vroeger</span>`
          : `<span style="color:#16a34a;font-weight:bold;">op tijd</span>`;

      const tooltipHtml = `<div class="font-sans text-xs">
        <strong>${bus.operatorName} ${bus.line} → ${bus.destination}</strong><br/>
        <span>Bus ${bus.matnummer}${bus.ritnummer ? ` • Rit ${bus.ritnummer}` : ''}${bus.omloopnummer ? ` • Omloop ${bus.omloopnummer}` : ''}</span><br/>
        <span>${delayText} • ${bus.lastUpdated}</span>
      </div>`;

      if (currentMarkerMap.has(bus.id)) {
        const marker = currentMarkerMap.get(bus.id)!;
        marker.setLatLng([bus.lat, bus.lng]);
        marker.setIcon(icon);
        marker.setTooltipContent(tooltipHtml);
      } else {
        const marker = L.marker([bus.lat, bus.lng], { icon });
        marker.bindTooltip(tooltipHtml, {
          direction: 'top',
          offset: [0, -14],
        });

        marker.on('click', () => {
          onSelectBus(bus);
        });

        marker.addTo(map);
        currentMarkerMap.set(bus.id, marker);
      }
    });

    if (followedBusId) {
      const followed = visibleBuses.find((b) => b.id === followedBusId);
      if (followed) {
        map.panTo([followed.lat, followed.lng], { animate: true, duration: 1 });
      }
    }
  }, [buses, selectedBus, followedBusId, onSelectBus]);

  // Geolocation watch
  useEffect(() => {
    if (!isFollowingUserGps || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocatie wordt niet ondersteund door deze browser.');
      setIsFollowingUserGps(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (userGpsMarkerRef.current) {
          userGpsMarkerRef.current.setLatLng([lat, lng]);
        } else {
          userGpsMarkerRef.current = L.marker([lat, lng], {
            icon: createGpsLocationIcon(),
          }).addTo(map);
        }

        map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
        setGpsError(null);
      },
      (err) => {
        setGpsError(`Locatiefout: ${err.message}`);
        setIsFollowingUserGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isFollowingUserGps]);

  // Pan once when a new bus is clicked, without locking or overriding zoom so the user can freely zoom out
  useEffect(() => {
    if (!selectedBus) {
      lastSelectedBusIdRef.current = null;
      return;
    }
    if (mapInstanceRef.current && lastSelectedBusIdRef.current !== selectedBus.id) {
      lastSelectedBusIdRef.current = selectedBus.id;
      mapInstanceRef.current.panTo([selectedBus.lat, selectedBus.lng], {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedBus]);

  const jumpToLocation = (lat: number, lng: number, zoom = 14) => {
    if (!mapInstanceRef.current) return;
    onStopFollowBus();
    mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
  };

  const resetToMunicipality = () => {
    if (!mapInstanceRef.current) return;
    onStopFollowBus();
    if (municipalityOutlineRef.current) {
      const bounds = municipalityOutlineRef.current.getBounds();
      if (bounds.isValid()) {
        mapInstanceRef.current.flyToBounds(bounds, { padding: [20, 20], duration: 1.2 });
        return;
      }
    }
    mapInstanceRef.current.flyTo(
      [STEENWIJKERLAND_BOUNDS.center.lat, STEENWIJKERLAND_BOUNDS.center.lng],
      STEENWIJKERLAND_BOUNDS.defaultZoom,
      { duration: 1.2 }
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      <div
        ref={mapContainerRef}
        className="w-full h-full bg-black"
        id="map"
        style={{ backgroundColor: '#000000' }}
      />

      {/* Top Left Controls: DRGL styled */}
      <div className="absolute top-14 left-4 z-[500] flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-300 shadow-xl text-slate-800">
          {/* Haltes Checkbox */}
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:bg-slate-100 text-slate-800">
            <input
              type="checkbox"
              checked={showHaltes}
              onChange={(e) => onToggleHaltes(e.target.checked)}
              className="w-4 h-4 rounded text-[#0E518D] focus:ring-[#0E518D] border-slate-400"
            />
            <span>Haltes ({STEENWIJKERLAND_STOPS.length})</span>
          </label>

          <div className="w-[1px] h-5 bg-slate-200" />

          {/* Lines Toggle */}
          <button
            onClick={() => onToggleRoutes(!showRoutes)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              showRoutes ? 'bg-[#0E518D]/10 text-[#0E518D] font-bold border border-[#0E518D]/30' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Toon lijnennetwerk (incl. Lijn 26 naar Meppel)"
          >
            {showRoutes ? <Eye className="w-3.5 h-3.5 text-[#0E518D]" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Lijnennet ({BUS_ROUTES.length})</span>
          </button>

          <div className="w-[1px] h-5 bg-slate-200" />

          {/* Deelfietsen Checkbox */}
          {onToggleDeelfietsen && (
            <>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:bg-sky-50 text-slate-800">
                <input
                  type="checkbox"
                  checked={showDeelfietsen}
                  onChange={(e) => onToggleDeelfietsen(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0086d6] focus:ring-[#0086d6] border-slate-400"
                />
                <Bike className="w-3.5 h-3.5 text-[#0086d6]" />
                <span>Deelfietsen ({deelfietsLocations.length})</span>
              </label>

              <div className="w-[1px] h-5 bg-slate-200" />
            </>
          )}

          {/* GPS Crosshair */}
          <button
            onClick={() => setIsFollowingUserGps(!isFollowingUserGps)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isFollowingUserGps ? 'bg-[#0E518D] text-[#FFCC00] shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Volg mijn GPS positie"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          {/* Layer switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Kaartlaag wijzigen"
            >
              <Layers className="w-4 h-4" />
            </button>

            {showLayerMenu && (
              <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-slate-300 rounded-xl shadow-2xl p-1.5 z-50 text-xs">
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Kaartlagen (Buiten grens zwart)
                </div>
                {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveTileLayer(key);
                      setShowLayerMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between ${
                      activeTileLayer === key ? 'bg-[#0E518D] text-white font-medium' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{TILE_LAYERS[key].name}</span>
                    {activeTileLayer === key && <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Camera Following Banner */}
        {followedBusId && (
          <div className="flex items-center justify-between gap-3 bg-[#0E518D] text-white px-3 py-1.5 rounded-lg text-xs shadow-lg animate-pulse">
            <div className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-[#FFCC00] animate-spin" />
              <span>Camera volgt bus #{buses.find((b) => b.id === followedBusId)?.matnummer}</span>
            </div>
            <button
              onClick={onStopFollowBus}
              className="underline text-[#FFCC00] hover:text-white font-semibold cursor-pointer"
            >
              Stop
            </button>
          </div>
        )}

        {gpsError && (
          <div className="bg-red-500/90 text-white px-3 py-1.5 rounded-lg text-xs shadow-md">
            {gpsError}
          </div>
        )}
      </div>

      {/* Top Right: Steenwijkerland Hotspots & Lijn 26 Quick Jump */}
      <div className="absolute top-4 right-4 z-[500] hidden md:flex items-center gap-1 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-300 shadow-xl text-slate-800">
        <span className="text-[11px] font-semibold text-slate-500 px-2 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-[#0E518D]" />
          Steenwijkerland:
        </span>
        <button
          onClick={resetToMunicipality}
          className="px-2 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          Gemeentegrens
        </button>
        <button
          onClick={() => jumpToLocation(52.79056, 6.11800, 15)}
          className="px-2 py-1 rounded-md text-xs font-semibold text-[#0E518D] hover:bg-[#0E518D]/10 transition-colors cursor-pointer"
        >
          Station Steenwijk
        </button>
        <button
          onClick={() => jumpToLocation(52.78539, 6.13210, 14)}
          className="px-2 py-1 rounded-md text-xs font-bold text-[#dc3545] hover:bg-red-50 transition-colors cursor-pointer"
          title="Bekijk Lijn 26 richting Meppel"
        >
          Lijn 26 → Meppel
        </button>
        <button
          onClick={() => jumpToLocation(52.73815, 6.07747, 14)}
          className="px-2 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Giethoorn
        </button>
        <button
          onClick={() => jumpToLocation(52.72800, 5.95705, 15)}
          className="px-2 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Blokzijl
        </button>
        <button
          onClick={() => jumpToLocation(52.68240, 5.95740, 15)}
          className="px-2 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Vollenhove
        </button>
        <button
          onClick={() => jumpToLocation(52.81738, 5.97783, 15)}
          className="px-2 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Oldemarkt
        </button>
      </div>

      {/* Bottom Right Zoom */}
      <div className="absolute bottom-6 right-4 z-[500] flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-300 shadow-2xl">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="p-2 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Inzoomen"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="p-2 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Uitzoomen"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-full h-[1px] bg-slate-200 my-0.5" />
        <button
          onClick={resetToMunicipality}
          className="p-2 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Centreer op Steenwijkerland"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
