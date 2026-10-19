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
import { DRGLDeparture, DRGLJourneyData } from './utils/drgl';
import { PunctualityLogEntry, sanitizeLogId } from './utils/punctuality';
import {
  DeelfietsLocation,
  DeelfietsLogEntry,
  STEENWIJKERLAND_DEELFIETS_HUBS,
} from './utils/deelfiets';
import { STEENWIJKERLAND_BOUNDS, STEENWIJKERLAND_STOPS } from './data/steenwijkerland';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  signOutFirebase,
  syncPunctualityLogsToFirestore,
  subscribeUserPunctualityLogs,
  User,
} from './firebase';
import { PanelLeftClose, PanelLeftOpen, Moon, Sparkles, BarChart3, Bike } from 'lucide-react';

const LOCAL_STORAGE_LOGS_KEY = 'swk_punctuality_logs_v1';

export default function App() {
  const [buses, setBuses] = useState<BusPosition[]>([]);
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

  const totalAvailableDeelfietsen = useMemo(() => {
    return deelfietsLocations.reduce((acc, loc) => acc + (loc.available || 0), 0);
  }, [deelfietsLocations]);

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

  // 2. Fetch Live Bus Positions (respecting strict Live vs Demo mode)
  const fetchBusPositions = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { north, south, east, west } = STEENWIJKERLAND_BOUNDS;
      const res = await fetch(
        `/api/busposities?north=${north}&south=${south}&east=${east}&west=${west}&onlySteenwijkerland=true&mode=${feedMode}`
      );

      if (res.ok) {
        const data = await res.json();
        setBuses(data.buses || []);
        if (data.statusMessage) {
          setStatusMessage(data.statusMessage);
        }
      }
    } catch (e) {
      console.warn('Bus fetch error:', e);
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

    const busInterval = setInterval(fetchBusPositions, 3000);
    const depInterval = setInterval(() => {
      fetchDepartures(selectedStopCode);
      fetchPunctualityLogs();
    }, 20000);
    const deelfietsInterval = setInterval(fetchDeelfietsData, 30000);

    return () => {
      clearInterval(busInterval);
      clearInterval(depInterval);
      clearInterval(deelfietsInterval);
    };
  }, [
    selectedStopCode,
    fetchDepartures,
    fetchBusPositions,
    fetchPunctualityLogs,
    fetchDeelfietsData,
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
          setDeelfietsLocationFilter('');
          setIsDeelfietsModalOpen(true);
        }}
        deelfietsAvailableCount={totalAvailableDeelfietsen}
        loggedCount={punctualityLogs.length}
        dataSource={dataSource}
        isSyncing={isSyncing}
        onManualRefresh={() => {
          fetchBusPositions();
          fetchDepartures(selectedStopCode);
          triggerLivePunctualityScan();
          fetchDeelfietsData();
        }}
        feedMode={feedMode}
        onToggleFeedMode={(mode) => setFeedMode(mode)}
        statusMessage={statusMessage}
      />

      {/* Main Viewport */}
      <main className="flex-1 relative flex w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-black">
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
              setDeelfietsLocationFilter(loc.name);
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

          {/* Real-Time Live Status Banner on Map when 0 buses active at night */}
          {feedMode === 'live' && buses.length === 0 && (
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
                setDeelfietsLocationFilter('');
                setIsDeelfietsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00B1FF] text-white text-xs font-bold shadow-lg hover:bg-sky-600 transition-colors cursor-pointer"
              title="Deelfiets Nederland locaties in Steenwijkerland: gemiddelden en totalen per dag, week en maand"
            >
              <Bike className="w-4 h-4 text-white" />
              <span>Deelfietsen ({totalAvailableDeelfietsen} vrij) (.CSV)</span>
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

        {/* Deelfiets Nederland Dashboard Modal (Alle locaties Steenwijkerland + Dag/Week/Maand statistieken) */}
        <DeelfietsDashboard
          isOpen={isDeelfietsModalOpen}
          onClose={() => setIsDeelfietsModalOpen(false)}
          locations={deelfietsLocations}
          logs={deelfietsLogs}
          initialLocationFilter={deelfietsLocationFilter}
          onTriggerLiveScan={triggerLiveDeelfietsScan}
          isScanning={isScanningDeelfiets}
        />
      </main>
    </div>
  );
}
