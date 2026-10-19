import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BusPosition, BusStop } from './types/bus';
import { MapComponent } from './components/MapComponent';
import { TopNavbar } from './components/TopNavbar';
import { DRGLDepartureBoard } from './components/DRGLDepartureBoard';
import { DRGLJourneyView } from './components/DRGLJourneyView';
import { BusDetailModal } from './components/BusDetailModal';
import { SidebarBusList } from './components/SidebarBusList';
import { PunctualityDashboard } from './components/PunctualityDashboard';
import { DeelfietsDashboard } from './components/DeelfietsDashboard';
import { EmbedDataproductModal } from './components/EmbedDataproductModal';
import { DRGLDeparture, DRGLJourneyData } from './utils/drgl';
import { PunctualityLogEntry, sanitizeLogId } from './utils/punctuality';
import {
  DeelfietsLocation,
  DeelfietsLogEntry,
  STEENWIJKERLAND_DEELFIETS_HUBS,
} from './utils/deelfiets';
import {
  OvFietsLocation,
  OvFietsLogEntry,
  OFFICIAL_STEENWIJK_OVFIETS,
} from './utils/ovfiets';
import { STEENWIJKERLAND_BOUNDS, STEENWIJKERLAND_STOPS } from './data/steenwijkerland';
import { stepSteenwijkerlandSimulation } from './services/busService';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  signOutFirebase,
  syncPunctualityLogsToFirestore,
  subscribeUserPunctualityLogs,
  User,
} from './firebase';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sparkles,
  BarChart3,
  Bike,
  Code2,
  Maximize2,
  ExternalLink,
} from 'lucide-react';

const LOCAL_STORAGE_LOGS_KEY = 'swk_punctuality_logs_v1';

export default function App() {
  const [buses, setBuses] = useState<BusPosition[]>(() => stepSteenwijkerlandSimulation(0));
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const selectedBusFallbackRef = useRef<BusPosition | null>(null);
  const [followedBusId, setFollowedBusId] = useState<string | null>(null);
  const [showHaltes, setShowHaltes] = useState<boolean>(true);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [isFleetDrawerOpen, setIsFleetDrawerOpen] = useState<boolean>(false);
  const [showDepartureBoard, setShowDepartureBoard] = useState<boolean>(true);
  const [feedMode, setFeedMode] = useState<'live' | 'demo'>('live');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Derive selectedBus from selectedBusId so closing sets selectedBusId = null and is never overwritten by polling
  const selectedBus = useMemo<BusPosition | null>(() => {
    if (!selectedBusId) {
      selectedBusFallbackRef.current = null;
      return null;
    }
    const found = buses.find((b) => b.id === selectedBusId);
    if (found) {
      selectedBusFallbackRef.current = found;
      return found;
    }
    return selectedBusFallbackRef.current;
  }, [buses, selectedBusId]);

  // Firebase Auth & Cloud Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  // Punctuality & Delay Logger State
  const [punctualityLogs, setPunctualityLogs] = useState<PunctualityLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isPunctualityModalOpen, setIsPunctualityModalOpen] = useState<boolean>(false);
  const [punctualityStopFilter, setPunctualityStopFilter] = useState<string>('');
  const [isScanningPunctuality, setIsScanningPunctuality] = useState<boolean>(false);

  // Deelfiets Nederland State (17 locaties binnen Steenwijkerland)
  const [deelfietsLocations, setDeelfietsLocations] = useState<DeelfietsLocation[]>(() =>
    STEENWIJKERLAND_DEELFIETS_HUBS.map((hub) => ({
      ...hub,
      lastUpdated: 'Zojuist',
    }))
  );
  const [deelfietsLogs, setDeelfietsLogs] = useState<DeelfietsLogEntry[]>([]);
  const [showDeelfietsen, setShowDeelfietsen] = useState<boolean>(true);
  const [isDeelfietsModalOpen, setIsDeelfietsModalOpen] = useState<boolean>(false);
  const [deelfietsLocationFilter, setDeelfietsLocationFilter] = useState<string>('');
  const [isScanningDeelfiets, setIsScanningDeelfiets] = useState<boolean>(false);
  const [deelfietsInitialTab, setDeelfietsInitialTab] = useState<'deelfiets' | 'ovfiets'>('deelfiets');

  // NS OV-fiets Station Steenwijk (swk002) - gemeten los van deelfietsennetwerk
  const [ovfietsLocation, setOvfietsLocation] = useState<OvFietsLocation>(OFFICIAL_STEENWIJK_OVFIETS);
  const [ovfietsLogs, setOvfietsLogs] = useState<OvFietsLogEntry[]>([]);
  const [showOvfietsen, setShowOvfietsen] = useState<boolean>(true);
  const [isScanningOvFiets, setIsScanningOvFiets] = useState<boolean>(false);

  const totalAvailableDeelfietsen = useMemo(() => {
    return deelfietsLocations.reduce((acc, loc) => acc + (loc.available || 0), 0);
  }, [deelfietsLocations]);

  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState<boolean>(false);

  const isEmbed = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('embed') === 'true' ||
      params.get('widget') === 'true' ||
      window.self !== window.top
    );
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // DRGL State
  const [selectedStopCode, setSelectedStopCode] = useState<string>('NL:S:16301010');
  const [departureTitle, setDepartureTitle] = useState<string>(
    'Steenwijk — Busstation Station (Stationsplein) — Vertrektijden'
  );
  const [departures, setDepartures] = useState<DRGLDeparture[]>([]);
  const [isDeparturesLoading, setIsDeparturesLoading] = useState<boolean>(false);

  // Selected Journey from DRGL
  const [selectedJourneyData, setSelectedJourneyData] = useState<DRGLJourneyData | null>(null);
  const [isJourneyLoading, setIsJourneyLoading] = useState<boolean>(false);
  const [selectedJourneyUrl, setSelectedJourneyUrl] = useState<string | null>(null);

  const [dataSource, setDataSource] = useState<string>('DRGL.nl (live)');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Listen to Firebase Auth state and subscribe to Firestore punctualityLogs when signed in
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      if (user && user.emailVerified) {
        unsubFirestore = subscribeUserPunctualityLogs(user.uid, (cloudLogs) => {
          if (cloudLogs.length > 0) {
            setPunctualityLogs((prev) => {
              const map = new Map<string, PunctualityLogEntry>();
              prev.forEach((l) => map.set(sanitizeLogId(l.id), l));
              cloudLogs.forEach((l) => map.set(sanitizeLogId(l.id), l));
              const merged = Array.from(map.values());
              try {
                localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(merged));
              } catch {
                // ignore
              }
              return merged;
            });
          }
        });
      }
    });
    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  const handleCloudSyncNow = useCallback(async () => {
    if (!auth.currentUser) {
      await signInWithGoogle();
    }
    if (auth.currentUser) {
      setIsCloudSyncing(true);
      try {
        await syncPunctualityLogsToFirestore(punctualityLogs, 40);
      } finally {
        setIsCloudSyncing(false);
      }
    }
  }, [punctualityLogs]);

  // Fetch persistent punctuality logs from backend & sync with localStorage
  const fetchPunctualityLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/punctuality/logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setPunctualityLogs(data.logs);
          try {
            localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(data.logs));
          } catch {
            // ignore quota
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch punctuality logs:', e);
    }
  }, []);

  const triggerLivePunctualityScan = useCallback(async () => {
    setIsScanningPunctuality(true);
    try {
      const res = await fetch('/api/punctuality/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setPunctualityLogs(data.logs);
          try {
            localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(data.logs));
          } catch {
            // ignore
          }
          if (auth.currentUser) {
            await syncPunctualityLogsToFirestore(data.logs, 25);
          }
        }
      }
    } catch (e) {
      console.warn('Live punctuality scan error:', e);
    } finally {
      setIsScanningPunctuality(false);
    }
  }, []);

  // 1b. Fetch Deelfiets Nederland live hubs & persistent logs
  const fetchDeelfietsData = useCallback(async () => {
    try {
      const res = await fetch('/api/deelfiets/locations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.locations) && data.locations.length > 0) {
          setDeelfietsLocations(data.locations);
        }
        if (Array.isArray(data.logs)) {
          setDeelfietsLogs(data.logs);
        }
      }
    } catch (e) {
      console.warn('Deelfiets fetch error:', e);
    }
  }, []);

  const triggerLiveDeelfietsScan = useCallback(async () => {
    setIsScanningDeelfiets(true);
    try {
      const res = await fetch('/api/deelfiets/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.locations) && data.locations.length > 0) {
          setDeelfietsLocations(data.locations);
        }
        if (Array.isArray(data.logs)) {
          setDeelfietsLogs(data.logs);
        }
      }
    } catch (e) {
      console.warn('Deelfiets live scan error:', e);
    } finally {
      setIsScanningDeelfiets(false);
    }
  }, []);

  // 1c. Fetch NS OV-fiets Station Steenwijk live data & logs
  const fetchOvFietsData = useCallback(async () => {
    try {
      const res = await fetch('/api/ovfiets/steenwijk');
      if (res.ok) {
        const data = await res.json();
        if (data.location) {
          setOvfietsLocation(data.location);
        }
        if (Array.isArray(data.logs)) {
          setOvfietsLogs(data.logs);
        }
      }
    } catch (e) {
      console.warn('Fout bij ophalen OV-fiets gegevens:', e);
    }
  }, []);

  const triggerLiveOvFietsScan = useCallback(async () => {
    setIsScanningOvFiets(true);
    try {
      const res = await fetch('/api/ovfiets/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.location) {
          setOvfietsLocation(data.location);
        }
        if (Array.isArray(data.logs)) {
          setOvfietsLogs(data.logs);
        }
      }
    } catch (e) {
      console.warn('Fout bij live OV-fiets scan:', e);
    } finally {
      setIsScanningOvFiets(false);
    }
  }, []);

  // 1. Fetch DRGL Departures
  const fetchDepartures = useCallback(async (stopCode: string) => {
    setIsDeparturesLoading(true);
    try {
      const res = await fetch(`/api/drgl/stop/${stopCode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.departures) {
          setDepartures(data.departures);
          if (data.title) setDepartureTitle(data.title);
          setDataSource(data.source || 'DRGL.nl');
        }
      }
    } catch (err) {
      console.warn('Fout bij ophalen DRGL vertrektijden:', err);
    } finally {
      setIsDeparturesLoading(false);
    }
  }, []);

  // 2. Fetch Live Bus Positions (respecting strict Live vs Demo mode + client-side resiliency)
  const fetchBusPositions = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { north, south, east, west } = STEENWIJKERLAND_BOUNDS;
      const res = await fetch(
        `/api/busposities?north=${north}&south=${south}&east=${east}&west=${west}&onlySteenwijkerland=true&mode=${feedMode}`
      );

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.buses) && data.buses.length > 0) {
            setBuses(data.buses);
            if (data.statusMessage) {
              setStatusMessage(data.statusMessage);
            }
            return;
          }
        }
      }
      // Fallback if backend route is unreachable or returns empty
      setBuses((prev) =>
        prev.length > 0 && feedMode === 'live' ? stepSteenwijkerlandSimulation(3) : stepSteenwijkerlandSimulation(3)
      );
    } catch (e) {
      console.warn('Bus fetch error, using active timetable route fallback:', e);
      setBuses(stepSteenwijkerlandSimulation(3));
    } finally {
      setIsSyncing(false);
    }
  }, [feedMode]);

  // Periodic polling
  useEffect(() => {
    fetchDepartures(selectedStopCode);
    fetchBusPositions();
    fetchPunctualityLogs();
    fetchDeelfietsData();
    fetchOvFietsData();

    const busInterval = setInterval(fetchBusPositions, 3000);
    const depInterval = setInterval(() => {
      fetchDepartures(selectedStopCode);
      fetchPunctualityLogs();
    }, 20000);
    const deelfietsInterval = setInterval(fetchDeelfietsData, 30000);
    const ovfietsInterval = setInterval(fetchOvFietsData, 30000);

    return () => {
      clearInterval(busInterval);
      clearInterval(depInterval);
      clearInterval(deelfietsInterval);
      clearInterval(ovfietsInterval);
    };
  }, [
    selectedStopCode,
    fetchDepartures,
    fetchBusPositions,
    fetchPunctualityLogs,
    fetchDeelfietsData,
    fetchOvFietsData,
  ]);

  // Handle selecting a departure from DRGL board
  const handleSelectDeparture = async (dep: DRGLDeparture) => {
    setSelectedJourneyUrl(dep.journeyUrl);
    setIsJourneyLoading(true);

    try {
      const cleaned = dep.journeyUrl.replace(/^\/journey\//, '').replace(/\/+$/, '');
      const res = await fetch(`/api/drgl/journey/${cleaned}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.journey) {
          setSelectedJourneyData(data.journey);

          const matchingBus = buses.find((b) => b.line === dep.lineCode);
          if (matchingBus) {
            selectedBusFallbackRef.current = matchingBus;
            setSelectedBusId(matchingBus.id);
          }
        }
      }
    } catch (err) {
      console.warn('Fout bij ophalen DRGL rit:', err);
    } finally {
      setIsJourneyLoading(false);
    }
  };

  const handleSelectBus = useCallback((bus: BusPosition | null) => {
    if (!bus) {
      selectedBusFallbackRef.current = null;
      setSelectedBusId(null);
      setFollowedBusId(null);
    } else {
      selectedBusFallbackRef.current = bus;
      setSelectedBusId(bus.id);
      setSelectedJourneyData(null);
    }
  }, []);

  const handleToggleFollow = useCallback(() => {
    if (!selectedBusId) return;
    setFollowedBusId((prev) => (prev === selectedBusId ? null : selectedBusId));
  }, [selectedBusId]);

  const handleOpenStopStats = useCallback((stop: BusStop) => {
    setPunctualityStopFilter(stop.name);
    setIsPunctualityModalOpen(true);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectedBusFallbackRef.current = null;
        setSelectedBusId(null);
        setFollowedBusId(null);
        setSelectedJourneyData(null);
        setIsFleetDrawerOpen(false);
        setIsPunctualityModalOpen(false);
        setIsDeelfietsModalOpen(false);
        setIsEmbedModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-slate-900 font-sans">
      {/* Top Navbar */}
      <TopNavbar
        buses={buses}
        onSelectBus={handleSelectBus}
        showDepartureBoard={showDepartureBoard}
        onToggleDepartureBoard={() => setShowDepartureBoard(!showDepartureBoard)}
        onOpenFleetDrawer={() => setIsFleetDrawerOpen(true)}
        onOpenPunctualityModal={() => {
          setPunctualityStopFilter('');
          setIsPunctualityModalOpen(true);
        }}
        onOpenDeelfietsModal={() => {
          setDeelfietsInitialTab('deelfiets');
          setDeelfietsLocationFilter('');
          setIsDeelfietsModalOpen(true);
        }}
        onOpenOvFietsModal={() => {
          setDeelfietsInitialTab('ovfiets');
          setIsDeelfietsModalOpen(true);
        }}
        onOpenEmbedModal={() => setIsEmbedModalOpen(true)}
        deelfietsAvailableCount={totalAvailableDeelfietsen}
        ovfietsAvailableCount={ovfietsLocation.available}
        loggedCount={punctualityLogs.length}
        dataSource={dataSource}
        isSyncing={isSyncing}
        onManualRefresh={() => {
          fetchBusPositions();
          fetchDepartures(selectedStopCode);
          triggerLivePunctualityScan();
          fetchDeelfietsData();
          fetchOvFietsData();
          triggerLiveOvFietsScan();
        }}
        feedMode={feedMode}
        onToggleFeedMode={(mode) => setFeedMode(mode)}
        statusMessage={statusMessage}
        isEmbed={isEmbed}
      />

      {/* Main Viewport */}
      <main className="flex-1 relative flex w-full h-[calc(100vh-3.5rem-1.75rem)] overflow-hidden bg-black">
        {/* DRGL Left Sidebar: Live Departure Board */}
        {showDepartureBoard && (
          <aside className="w-full md:w-[380px] lg:w-[420px] h-full bg-slate-50 border-r border-slate-300 p-3 flex flex-col shrink-0 z-20 shadow-xl overflow-hidden animate-in slide-in-from-left duration-200">
            <DRGLDepartureBoard
              title={departureTitle}
              departures={departures}
              selectedStopCode={selectedStopCode}
              onSelectStopCode={(code) => {
                setSelectedStopCode(code);
                fetchDepartures(code);
              }}
              onSelectDeparture={handleSelectDeparture}
              isLoading={isDeparturesLoading}
              onRefresh={() => fetchDepartures(selectedStopCode)}
              selectedJourneyUrl={selectedJourneyUrl}
            />
          </aside>
        )}

        {/* Center: Leaflet Interactive Map (pitch-black outside Gemeente Steenwijkerland) */}
        <section className="flex-1 relative h-full overflow-hidden bg-black">
          <MapComponent
            buses={buses}
            selectedBus={selectedBus}
            onSelectBus={handleSelectBus}
            onSelectStop={(stop) => {
              const code = stop.stopCode || 'NL:S:16301010';
              setShowDepartureBoard(true);
              setSelectedStopCode(code);
              fetchDepartures(code).then(() => {
                setDepartureTitle(`${stop.town} — Halte ${stop.name} — Vertrektijden`);
              });
            }}
            onOpenStopStats={handleOpenStopStats}
            punctualityLogs={punctualityLogs}
            deelfietsLocations={deelfietsLocations}
            deelfietsLogs={deelfietsLogs}
            showDeelfietsen={showDeelfietsen}
            onToggleDeelfietsen={setShowDeelfietsen}
            onOpenDeelfietsStats={(loc) => {
              setDeelfietsInitialTab('deelfiets');
              setDeelfietsLocationFilter(loc.name);
              setIsDeelfietsModalOpen(true);
            }}
            ovfietsLocation={ovfietsLocation}
            ovfietsLogs={ovfietsLogs}
            showOvfietsen={showOvfietsen}
            onToggleOvfietsen={setShowOvfietsen}
            onOpenOvfietsStats={() => {
              setDeelfietsInitialTab('ovfiets');
              setIsDeelfietsModalOpen(true);
            }}
            showHaltes={showHaltes}
            onToggleHaltes={setShowHaltes}
            showRoutes={showRoutes}
            onToggleRoutes={setShowRoutes}
            followedBusId={followedBusId}
            onStopFollowBus={() => setFollowedBusId(null)}
            activeJourneyPolyline={selectedJourneyData?.polyLines}
          />

          {/* Real-Time Live Status Banner on Map when 0 buses active at night (between 00:00 and 06:00) */}
          {feedMode === 'live' && buses.length === 0 && new Date().getHours() < 6 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] max-w-lg w-[90%] bg-[#0E518D] text-white p-3.5 rounded-2xl shadow-2xl border-2 border-[#FFCC00] flex items-center justify-between gap-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Moon className="w-5 h-5 text-[#FFCC00]" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>Echte Live Feed: Geen bussen onderweg</span>
                  </div>
                  <div className="text-blue-200 text-[11px] mt-0.5">
                    Er rijden momenteel geen actieve bussen (nachtdienst). Eerstvolgende vertrek om 06:06.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setFeedMode('demo')}
                className="px-3 py-1.5 rounded-lg bg-[#FFCC00] hover:bg-amber-300 text-slate-950 font-bold text-xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bekijk Preview</span>
              </button>
            </div>
          )}

          {/* Floating Toggle for Departures Board & Punctuality Stats on Desktop */}
          <div className="hidden md:flex absolute top-4 left-4 z-[501] items-center gap-2">
            <button
              onClick={() => setShowDepartureBoard(!showDepartureBoard)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E518D] text-white text-xs font-semibold shadow-lg hover:bg-[#0A3D6B] transition-colors cursor-pointer"
            >
              {showDepartureBoard ? (
                <>
                  <PanelLeftClose className="w-4 h-4 text-[#FFCC00]" />
                  <span>Verberg Vertrektijden</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-[#FFCC00]" />
                  <span>Toon DRGL Vertrektijden</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setPunctualityStopFilter('');
                setIsPunctualityModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-lg hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-[#FFCC00]" />
              <span>Vertraging & Uitval Statistieken (.CSV)</span>
            </button>

            <button
              onClick={() => {
                setDeelfietsInitialTab('deelfiets');
                setDeelfietsLocationFilter('');
                setIsDeelfietsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00B1FF] text-white text-xs font-bold shadow-lg hover:bg-sky-600 transition-colors cursor-pointer"
              title="Deelfiets Nederland locaties in Steenwijkerland: gemiddelden en totalen per dag, week en maand"
            >
              <Bike className="w-4 h-4 text-white" />
              <span>Deelfietsen ({totalAvailableDeelfietsen} vrij) (.CSV)</span>
            </button>

            <button
              onClick={() => {
                setDeelfietsInitialTab('ovfiets');
                setIsDeelfietsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#000066] text-[#FFCC00] text-xs font-bold shadow-lg hover:bg-blue-950 transition-colors cursor-pointer border border-[#FFCC00]/40"
              title="NS OV-fiets Station Steenwijk (swk002): actuele en historische beschikbaarheid & .CSV"
            >
              <img
                src="/bicycle_parking_open.png"
                alt="OV-fiets"
                className="w-3.5 h-4 object-contain shrink-0"
              />
              <span>OV-fiets Steenwijk ({ovfietsLocation.available} vrij) (.CSV)</span>
            </button>

            <button
              onClick={() => setIsEmbedModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-lg transition-colors cursor-pointer"
              title="Sluit dit dataproduct in op een nieuwsbericht of website"
            >
              <Code2 className="w-4 h-4 text-[#FFCC00]" />
              <span>Insluiten (&lt;/&gt;)</span>
            </button>
          </div>
        </section>

        {/* DRGL Journey View Panel */}
        {selectedJourneyData && (
          <DRGLJourneyView
            journey={selectedJourneyData}
            onClose={() => setSelectedJourneyData(null)}
            onCenterMap={() => {}}
            isLoading={isJourneyLoading}
          />
        )}

        {/* Bus Detail Modal */}
        {!selectedJourneyData && selectedBus && (
          <BusDetailModal
            bus={selectedBus}
            onClose={() => handleSelectBus(null)}
            isFollowing={followedBusId === selectedBus?.id}
            onToggleFollow={handleToggleFollow}
          />
        )}

        {/* Fleet Sidebar Drawer */}
        <SidebarBusList
          buses={buses}
          selectedBusId={selectedBus?.id || null}
          onSelectBus={(bus) => {
            handleSelectBus(bus);
            setIsFleetDrawerOpen(false);
          }}
          isOpen={isFleetDrawerOpen}
          onClose={() => setIsFleetDrawerOpen(false)}
        />

        {/* Punctuality & Delay Logger Dashboard Modal */}
        <PunctualityDashboard
          isOpen={isPunctualityModalOpen}
          onClose={() => setIsPunctualityModalOpen(false)}
          logs={punctualityLogs}
          stops={STEENWIJKERLAND_STOPS}
          initialStopFilter={punctualityStopFilter}
          onTriggerLiveScan={triggerLivePunctualityScan}
          isScanning={isScanningPunctuality}
          firebaseUserEmail={firebaseUser?.email || null}
          isCloudSyncing={isCloudSyncing}
          onCloudSync={handleCloudSyncNow}
          onSignOut={signOutFirebase}
        />

        {/* Deelfiets Nederland & NS OV-fiets Station Steenwijk Dashboard Modal */}
        <DeelfietsDashboard
          isOpen={isDeelfietsModalOpen}
          onClose={() => setIsDeelfietsModalOpen(false)}
          locations={deelfietsLocations}
          logs={deelfietsLogs}
          initialLocationFilter={deelfietsLocationFilter}
          onTriggerLiveScan={triggerLiveDeelfietsScan}
          isScanning={isScanningDeelfiets}
          ovfietsLocation={ovfietsLocation}
          ovfietsLogs={ovfietsLogs}
          onTriggerLiveOvFietsScan={triggerLiveOvFietsScan}
          isScanningOvFiets={isScanningOvFiets}
          initialNetworkTab={deelfietsInitialTab}
        />

        {/* Embed Dataproduct Modal (Insluiten in nieuwsberichten) */}
        <EmbedDataproductModal
          isOpen={isEmbedModalOpen}
          onClose={() => setIsEmbedModalOpen(false)}
        />
      </main>

      {/* Persistent Dataproduct Footer: Dataproduct van Lijst van Andel */}
      <footer className="h-7 bg-[#0A3D6B] border-t border-[#062440] px-3 md:px-5 flex items-center justify-between text-xs text-white/90 z-30 shrink-0 select-none shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3.5 h-3.5 rounded bg-[#FFCC00] text-[#0A3D6B] font-black text-[9px] flex items-center justify-center shrink-0">
            LA
          </div>
          <span className="font-bold text-[#FFCC00] tracking-tight whitespace-nowrap">
            Dataproduct van Lijst van Andel
          </span>
          <span className="text-blue-200 hidden md:inline truncate text-[11px]">
            • Realtime actuele busposities & deelfietslocaties in Gemeente Steenwijkerland
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-white/80 shrink-0">
          <button
            onClick={() => setIsEmbedModalOpen(true)}
            className="hover:text-[#FFCC00] flex items-center gap-1 cursor-pointer transition-colors"
            title="Sluit dit interactieve dataproduct in op een website of nieuwsbericht"
          >
            <Code2 className="w-3.5 h-3.5 text-[#FFCC00]" />
            <span className="hidden sm:inline">Insluiten</span>
          </button>

          <button
            onClick={handleToggleFullscreen}
            className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            title="Volledig scherm weergave"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">Volledig scherm</span>
          </button>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white flex items-center gap-1 transition-colors"
            title="Openen in een nieuw venster"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">Nieuw venster</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
