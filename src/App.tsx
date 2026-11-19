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
import { AansluitingenDashboard } from './components/AansluitingenDashboard';
import { EmbedDataproductModal } from './components/EmbedDataproductModal';
import { DRGLDeparture, DRGLJourneyData } from './utils/drgl';
import { StopPopupSummary } from './utils/punctuality';
import { TrainPosition, ConnectionSummary } from './types/train';
import {
  DeelfietsLocation,
  DeelfietsPeriodStats,
  STEENWIJKERLAND_DEELFIETS_HUBS,
} from './utils/deelfiets';
import {
  OvFietsLocation,
  OvFietsPeriodStats,
  OFFICIAL_STEENWIJK_OVFIETS,
} from './utils/ovfiets';
import {
  STEENWIJKERLAND_BOUNDS,
  STEENWIJKERLAND_STOPS,
  isPointInSteenwijkerland,
} from './data/steenwijkerland';
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
  OslSession,
  subscribeOslSession,
  handleOslRedirectCallbackOnBoot,
  downloadProtectedExport,
  startOslLogin,
  logoutOsl,
} from './utils/oslAuth';
import {
  Moon,
  Sparkles,
  Code2,
  Maximize2,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
  X,
} from 'lucide-react';

const LEGACY_LOCAL_STORAGE_LOGS_KEY = 'swk_punctuality_logs_v1';

export default function App() {
  const [buses, setBuses] = useState<BusPosition[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const selectedBusFallbackRef = useRef<BusPosition | null>(null);
  const [followedBusId, setFollowedBusId] = useState<string | null>(null);
  const [showHaltes, setShowHaltes] = useState<boolean>(true);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [isFleetDrawerOpen, setIsFleetDrawerOpen] = useState<boolean>(false);
  const [showDepartureBoard, setShowDepartureBoard] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const embedded =
      params.get('embed') === 'true' ||
      params.get('widget') === 'true' ||
      window.self !== window.top;
    if (embedded) return false;
    return window.innerWidth >= 1100;
  });
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

  // Punctuality & Delay Logger State (lightweight summary only; raw data stays indexed in SQLite)
  const [punctualityTotalCount, setPunctualityTotalCount] = useState<number>(0);
  const [stopPopupStats, setStopPopupStats] = useState<Record<string, StopPopupSummary>>({});
  const [isPunctualityModalOpen, setIsPunctualityModalOpen] = useState<boolean>(false);
  const [punctualityStopFilter, setPunctualityStopFilter] = useState<string>('');
  const [dashboardRefreshNonce, setDashboardRefreshNonce] = useState<number>(0);

  // Deelfiets Nederland State (17 locaties binnen Steenwijkerland)
  const [deelfietsLocations, setDeelfietsLocations] = useState<DeelfietsLocation[]>(() =>
    STEENWIJKERLAND_DEELFIETS_HUBS.map((hub) => ({
      ...hub,
      lastUpdated: 'Zojuist',
    }))
  );
  const [deelfietsPopupStats, setDeelfietsPopupStats] = useState<DeelfietsPeriodStats[]>([]);
  const [showDeelfietsen, setShowDeelfietsen] = useState<boolean>(true);
  const [isDeelfietsModalOpen, setIsDeelfietsModalOpen] = useState<boolean>(false);
  const [deelfietsLocationFilter, setDeelfietsLocationFilter] = useState<string>('');
  const [deelfietsInitialTab, setDeelfietsInitialTab] = useState<'deelfiets' | 'ovfiets'>('deelfiets');

  // NS OV-fiets Station Steenwijk (swk002) - gemeten los van deelfietsennetwerk
  const [ovfietsLocation, setOvfietsLocation] = useState<OvFietsLocation>(OFFICIAL_STEENWIJK_OVFIETS);
  const [ovfietsPopupStats, setOvfietsPopupStats] = useState<OvFietsPeriodStats | null>(null);
  const [showOvfietsen, setShowOvfietsen] = useState<boolean>(true);

  // NS Trains & Bus-Trein Aansluitingen State
  const [trains, setTrains] = useState<TrainPosition[]>([]);
  const [selectedTrain, setSelectedTrain] = useState<TrainPosition | null>(null);
  const [showTrains, setShowTrains] = useState<boolean>(true);
  const [aansluitingenSummary, setAansluitingenSummary] = useState<ConnectionSummary | null>(null);
  const [isAansluitingenModalOpen, setIsAansluitingenModalOpen] = useState<boolean>(false);

  const totalAvailableDeelfietsen = useMemo(() => {
    return deelfietsLocations.reduce((acc, loc) => acc + (loc.available || 0), 0);
  }, [deelfietsLocations]);

  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState<boolean>(false);

  // OSL SSO Auth & Auto-Resume Export State
  const [oslSession, setOslSession] = useState<OslSession | null>(null);
  const [isOslBusy, setIsOslBusy] = useState<boolean>(false);
  const [ssoFeedback, setSsoFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

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

  // Clear legacy bloated localStorage key once on mount so browser storage stays clean
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_LOCAL_STORAGE_LOGS_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Subscribe to OSL SSO session & process standalone /sso/callback redirects on boot
  useEffect(() => {
    const unsub = subscribeOslSession(setOslSession);
    let cancelled = false;

    handleOslRedirectCallbackOnBoot().then(async (result) => {
      if (cancelled || !result.handled) return;

      if (result.error) {
        setSsoFeedback({ type: 'error', message: result.error });
        return;
      }

      if (result.pendingExport) {
        const { url, fallbackFilename, modal } = result.pendingExport;
        if (modal === 'punctuality') {
          setIsPunctualityModalOpen(true);
        } else if (modal === 'deelfiets') {
          setDeelfietsInitialTab('deelfiets');
          setIsDeelfietsModalOpen(true);
        } else if (modal === 'ovfiets') {
          setDeelfietsInitialTab('ovfiets');
          setIsDeelfietsModalOpen(true);
        } else if (modal === 'aansluitingen') {
          setIsAansluitingenModalOpen(true);
        }

        setSsoFeedback({
          type: 'success',
          message: 'Ingelogd via OSL SSO — export wordt direct gestart...',
        });

        try {
          await downloadProtectedExport(url, { fallbackFilename, modal });
          if (!cancelled) {
            setTimeout(() => {
              setSsoFeedback((prev) => (prev?.type === 'success' ? null : prev));
            }, 4500);
          }
        } catch (err: any) {
          if (!cancelled) {
            setSsoFeedback({
              type: 'error',
              message: err?.message || 'Automatische export na OSL SSO login mislukt.',
            });
          }
        }
      } else {
        setSsoFeedback({
          type: 'success',
          message: 'Succesvol ingelogd via Onafhankelijk Steenwijkerland SSO.',
        });
        setTimeout(() => {
          setSsoFeedback((prev) => (prev?.type === 'success' ? null : prev));
        }, 4000);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const handleOslLogin = useCallback(async () => {
    setIsOslBusy(true);
    setSsoFeedback(null);
    try {
      const session = await startOslLogin();
      if (session) {
        setSsoFeedback({
          type: 'success',
          message: `Ingelogd als ${
            session.user?.name || session.user?.username || session.user?.email || 'OSL gebruiker'
          }.`,
        });
        setTimeout(() => {
          setSsoFeedback((prev) => (prev?.type === 'success' ? null : prev));
        }, 4000);
      }
    } catch (err: any) {
      setSsoFeedback({
        type: 'error',
        message: err?.message || 'Inloggen via OSL SSO mislukt.',
      });
    } finally {
      setIsOslBusy(false);
    }
  }, []);

  const handleOslLogout = useCallback(async () => {
    setIsOslBusy(true);
    try {
      await logoutOsl(false);
      setSsoFeedback({
        type: 'success',
        message: 'Uitgelogd bij Onafhankelijk Steenwijkerland SSO.',
      });
      setTimeout(() => {
        setSsoFeedback((prev) => (prev?.type === 'success' ? null : prev));
      }, 3500);
    } finally {
      setIsOslBusy(false);
    }
  }, []);

  // Listen to Firebase Auth state and keep bounded Firestore subscription active when signed in
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      if (user && user.emailVerified) {
        unsubFirestore = subscribeUserPunctualityLogs(user.uid, () => {});
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
        const res = await fetch('/api/punctuality/logs?page=1&pageSize=40');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs) && data.logs.length > 0) {
            await syncPunctualityLogsToFirestore(data.logs, 40);
          }
        }
      } finally {
        setIsCloudSyncing(false);
      }
    }
  }, []);

  // Fetch compact punctuality summary for TopNavbar & Map stop popups (< 15 KB)
  const fetchPunctualitySummary = useCallback(async () => {
    try {
      const res = await fetch('/api/punctuality/summary');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.totalCount === 'number') {
          setPunctualityTotalCount(data.totalCount);
        }
        if (data.stopPopupStats) {
          setStopPopupStats(data.stopPopupStats);
        }
      }
    } catch (e) {
      console.warn('Could not fetch punctuality summary:', e);
    }
  }, []);

  const triggerLivePunctualityScan = useCallback(async () => {
    try {
      const res = await fetch('/api/punctuality/scan?page=1&pageSize=25', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === 'number') {
          setPunctualityTotalCount(data.count);
        }
        if (data.stopPopupStats) {
          setStopPopupStats(data.stopPopupStats);
        }
        setDashboardRefreshNonce((n) => n + 1);
        if (auth.currentUser && Array.isArray(data.logs)) {
          await syncPunctualityLogsToFirestore(data.logs, 25);
        }
      }
    } catch (e) {
      console.warn('Live punctuality scan error:', e);
    }
  }, []);

  // 1b. Fetch Deelfiets Nederland live hubs & rollup stats (no raw logs array!)
  const fetchDeelfietsData = useCallback(async () => {
    try {
      const res = await fetch('/api/deelfiets/locations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.locations) && data.locations.length > 0) {
          setDeelfietsLocations(data.locations);
        }
        if (Array.isArray(data.allStats)) {
          setDeelfietsPopupStats(data.allStats);
        }
      }
    } catch (e) {
      console.warn('Deelfiets fetch error:', e);
    }
  }, []);

  // 1c. Fetch NS OV-fiets Station Steenwijk live data & rollup stats
  const fetchOvFietsData = useCallback(async () => {
    try {
      const res = await fetch('/api/ovfiets/steenwijk?includeRaw=false');
      if (res.ok) {
        const data = await res.json();
        if (data.location) {
          setOvfietsLocation(data.location);
        }
        if (data.stats) {
          setOvfietsPopupStats(data.stats);
        }
      }
    } catch (e) {
      console.warn('Fout bij ophalen OV-fiets gegevens:', e);
    }
  }, []);

  const triggerLiveOvFietsScan = useCallback(async () => {
    try {
      const res = await fetch('/api/ovfiets/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.location) {
          setOvfietsLocation(data.location);
        }
        if (data.stats) {
          setOvfietsPopupStats(data.stats);
        }
        setDashboardRefreshNonce((n) => n + 1);
      }
    } catch (e) {
      console.warn('Fout bij live OV-fiets scan:', e);
    }
  }, []);

  // 1d. Fetch Live NS Trains in Steenwijkerland Corridor
  const fetchTrains = useCallback(async () => {
    try {
      const res = await fetch(`/api/treinen?mode=${feedMode}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.trains)) {
          // Strictly enforce: no trains outside Steenwijkerland municipal borders
          const inMunicipality = data.trains.filter((t: TrainPosition) =>
            isPointInSteenwijkerland(t.lat, t.lng)
          );
          setTrains(inMunicipality);
        }
      }
    } catch (e) {
      console.warn('Treinen fetch error:', e);
    }
  }, [feedMode]);

  // 1e. Fetch lightweight Bus-Trein Aansluitingen summary (< 5 KB)
  const fetchAansluitingenSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/aansluitingen/summary?period=day');
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setAansluitingenSummary(data.summary);
        }
      }
    } catch (e) {
      console.warn('Aansluitingen summary fetch error:', e);
    }
  }, []);

  const triggerLiveAansluitingenScan = useCallback(async () => {
    try {
      const res = await fetch('/api/aansluitingen/scan?includeRaw=false', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setAansluitingenSummary(data.summary);
        }
        setDashboardRefreshNonce((n) => n + 1);
      }
    } catch (e) {
      console.warn('Aansluitingen scan error:', e);
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

  // 2. Fetch Live Bus Positions (strictly real OVzoeker GTFS-RT vehicles in Live mode, never simulated ghost buses)
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
          if (Array.isArray(data.buses)) {
            setBuses(data.buses);
            if (data.statusMessage) {
              setStatusMessage(data.statusMessage);
            }
            return;
          }
        }
      }

      if (feedMode === 'demo') {
        setBuses(stepSteenwijkerlandSimulation(3));
      }
    } catch (e) {
      console.warn('Bus fetch error:', e);
      if (feedMode === 'demo') {
        setBuses(stepSteenwijkerlandSimulation(3));
      }
    } finally {
      setIsSyncing(false);
    }
  }, [feedMode]);

  // Periodic lightweight polling (compact summaries only; full logs load paginated on-demand)
  useEffect(() => {
    fetchDepartures(selectedStopCode);
    fetchBusPositions();
    fetchTrains();
    fetchAansluitingenSummary();
    fetchPunctualitySummary();
    fetchDeelfietsData();
    fetchOvFietsData();

    const busInterval = setInterval(fetchBusPositions, 3000);
    const trainInterval = setInterval(fetchTrains, 4000);
    const depInterval = setInterval(() => {
      fetchDepartures(selectedStopCode);
      fetchPunctualitySummary();
      fetchAansluitingenSummary();
    }, 20000);
    const deelfietsInterval = setInterval(fetchDeelfietsData, 30000);
    const ovfietsInterval = setInterval(fetchOvFietsData, 30000);

    return () => {
      clearInterval(busInterval);
      clearInterval(trainInterval);
      clearInterval(depInterval);
      clearInterval(deelfietsInterval);
      clearInterval(ovfietsInterval);
    };
  }, [
    selectedStopCode,
    fetchDepartures,
    fetchBusPositions,
    fetchTrains,
    fetchAansluitingenSummary,
    fetchPunctualitySummary,
    fetchDeelfietsData,
    fetchOvFietsData,
  ]);

  // Ensure Leaflet recalculates map size when departure board toggles
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
    return () => clearTimeout(timer);
  }, [showDepartureBoard]);

  // Handle selecting a departure from DRGL board
  const handleSelectDeparture = async (dep: DRGLDeparture) => {
    setSelectedJourneyUrl(dep.journeyUrl);
    setIsJourneyLoading(true);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setShowDepartureBoard(false);
    }

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
        setIsAansluitingenModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)] font-sans tabular-nums">
      {/* Top Navbar */}
      <TopNavbar
        buses={buses}
        onSelectBus={handleSelectBus}
        showDepartureBoard={showDepartureBoard}
        onToggleDepartureBoard={() => setShowDepartureBoard(!showDepartureBoard)}
        onShowMapOnly={() => setShowDepartureBoard(false)}
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
        onOpenAansluitingenModal={() => setIsAansluitingenModalOpen(true)}
        trainsCount={trains.length}
        transferSuccessRate={aansluitingenSummary?.successRate || 0}
        onOpenEmbedModal={() => setIsEmbedModalOpen(true)}
        deelfietsAvailableCount={totalAvailableDeelfietsen}
        ovfietsAvailableCount={ovfietsLocation.available}
        loggedCount={punctualityTotalCount}
        dataSource={dataSource}
        isSyncing={isSyncing}
        onManualRefresh={() => {
          fetchBusPositions();
          fetchTrains();
          fetchDepartures(selectedStopCode);
          triggerLivePunctualityScan();
          fetchDeelfietsData();
          fetchOvFietsData();
          triggerLiveOvFietsScan();
          triggerLiveAansluitingenScan();
        }}
        feedMode={feedMode}
        onToggleFeedMode={(mode) => setFeedMode(mode)}
        statusMessage={statusMessage}
        isEmbed={isEmbed}
        oslSession={oslSession}
        onOslLogin={handleOslLogin}
        onOslLogout={handleOslLogout}
        isOslBusy={isOslBusy}
      />

      {/* Main Viewport */}
      <main className="flex-1 relative flex w-full overflow-hidden bg-[var(--bg-main)]">
        {/* OSL SSO Inline Toast / Feedback Banner */}
        {ssoFeedback && (
          <div
            role="status"
            className={`fixed top-14 right-3 z-[2200] max-w-sm px-3 py-2 rounded-[5px] border shadow-2xl flex items-start gap-2 text-xs ${
              ssoFeedback.type === 'error'
                ? 'bg-[var(--bg-elevated)] border-[var(--status-rose)] text-[var(--status-rose)]'
                : 'bg-[var(--bg-elevated)] border-[var(--status-emerald)] text-[var(--status-emerald)]'
            }`}
          >
            {ssoFeedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 text-[var(--text-main)] leading-snug">
              {ssoFeedback.message}
            </span>
            <button
              onClick={() => setSsoFeedback(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0 cursor-pointer"
              aria-label="Sluit melding"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {/* Mobile/Iframe Backdrop when Departure Board is open */}
        {showDepartureBoard && (
          <div
            onClick={() => setShowDepartureBoard(false)}
            className="lg:hidden fixed inset-0 bg-black/60 z-[510] cursor-pointer"
          />
        )}

        {/* DRGL Left Sidebar: Live Departure Board */}
        {showDepartureBoard && (
          <aside className="absolute inset-y-0 left-0 w-full sm:w-[360px] lg:static lg:w-[390px] h-full bg-[var(--bg-main)] border-r border-[var(--border-subtle)] p-2 flex flex-col shrink-0 z-[520] lg:z-20 overflow-hidden shadow-2xl lg:shadow-none">
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
              onClose={() => setShowDepartureBoard(false)}
            />
          </aside>
        )}

        {/* Center: Leaflet Interactive Map (pitch-black outside Gemeente Steenwijkerland) */}
        <section className="flex-1 relative w-full h-full overflow-hidden bg-[var(--bg-main)]">
          <MapComponent
            buses={buses}
            selectedBus={selectedBus}
            onSelectBus={handleSelectBus}
            trains={trains}
            selectedTrain={selectedTrain}
            onSelectTrain={setSelectedTrain}
            showTrains={showTrains}
            onToggleTrains={setShowTrains}
            onSelectStop={(stop) => {
              const code = stop.stopCode || 'NL:S:16301010';
              setShowDepartureBoard(true);
              setSelectedStopCode(code);
              fetchDepartures(code).then(() => {
                setDepartureTitle(`${stop.town} — Halte ${stop.name} — Vertrektijden`);
              });
            }}
            onOpenStopStats={handleOpenStopStats}
            stopPopupStats={stopPopupStats}
            deelfietsLocations={deelfietsLocations}
            deelfietsStatsList={deelfietsPopupStats}
            showDeelfietsen={showDeelfietsen}
            onToggleDeelfietsen={setShowDeelfietsen}
            onOpenDeelfietsStats={(loc) => {
              setDeelfietsInitialTab('deelfiets');
              setDeelfietsLocationFilter(loc.name);
              setIsDeelfietsModalOpen(true);
            }}
            ovfietsLocation={ovfietsLocation}
            ovfietsStats={ovfietsPopupStats}
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
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] max-w-lg w-[90%] bg-[var(--bg-elevated)] text-[var(--text-main)] p-3.5 rounded-[5px] shadow-2xl border border-[var(--border-focus)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[4px] bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                  <Moon className="w-4 h-4 text-[var(--accent-gold)]" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                    <span>Echte Live Feed: Geen bussen onderweg</span>
                  </div>
                  <div className="text-[var(--text-muted)] text-[11px] mt-0.5 tabular-nums">
                    Er rijden momenteel geen actieve bussen (nachtdienst). Eerstvolgende vertrek om 06:06.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setFeedMode('demo')}
                className="px-3 py-1.5 rounded-[4px] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-bright)] text-[#060e0a] font-bold text-xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bekijk Preview</span>
              </button>
            </div>
          )}
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
          stops={STEENWIJKERLAND_STOPS}
          initialStopFilter={punctualityStopFilter}
          onDataUpdated={(total, popupStats) => {
            setPunctualityTotalCount(total);
            if (popupStats) setStopPopupStats(popupStats);
          }}
          firebaseUserEmail={firebaseUser?.email || null}
          isCloudSyncing={isCloudSyncing}
          onCloudSync={handleCloudSyncNow}
          onSignOut={signOutFirebase}
          refreshNonce={dashboardRefreshNonce}
        />

        {/* Deelfiets Nederland & NS OV-fiets Station Steenwijk Dashboard Modal */}
        <DeelfietsDashboard
          isOpen={isDeelfietsModalOpen}
          onClose={() => setIsDeelfietsModalOpen(false)}
          locations={deelfietsLocations}
          initialLocationFilter={deelfietsLocationFilter}
          ovfietsLocation={ovfietsLocation}
          initialNetworkTab={deelfietsInitialTab}
          onDeelfietsUpdated={(locs, allStats) => {
            setDeelfietsLocations(locs);
            setDeelfietsPopupStats(allStats);
          }}
          onOvFietsUpdated={(loc, stats) => {
            setOvfietsLocation(loc);
            setOvfietsPopupStats(stats);
          }}
          refreshNonce={dashboardRefreshNonce}
        />

        {/* Aansluitingen & Overstap Station Steenwijk Dashboard Modal */}
        <AansluitingenDashboard
          isOpen={isAansluitingenModalOpen}
          onClose={() => setIsAansluitingenModalOpen(false)}
          onSummaryUpdated={setAansluitingenSummary}
          refreshNonce={dashboardRefreshNonce}
        />

        {/* Embed Dataproduct Modal (Insluiten in nieuwsberichten) */}
        <EmbedDataproductModal
          isOpen={isEmbedModalOpen}
          onClose={() => setIsEmbedModalOpen(false)}
        />
      </main>

      {/* Persistent Dataproduct Footer: Dataproduct van Lijst van Andel */}
      <footer className="h-7 bg-[var(--bg-card)] border-t border-[var(--border-subtle)] px-3 md:px-5 flex items-center justify-between text-xs text-[var(--text-muted)] z-30 shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-4 h-4 rounded-[3px] bg-[var(--accent-gold)] text-[#060e0a] font-extrabold text-[9px] flex items-center justify-center shrink-0">
            LA
          </div>
          <span className="font-bold text-[var(--accent-gold-bright)] tracking-tight whitespace-nowrap">
            Dataproduct van Lijst van Andel
          </span>
          <span className="text-[var(--text-dim)] hidden md:inline truncate text-[11px]">
            · Realtime actuele busposities &amp; deelfietslocaties in Gemeente Steenwijkerland
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] shrink-0">
          <button
            onClick={() => setIsEmbedModalOpen(true)}
            className="hover:text-[var(--accent-gold-bright)] flex items-center gap-1 cursor-pointer transition-colors"
            title="Sluit dit interactieve dataproduct in op een website of nieuwsbericht"
          >
            <Code2 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            <span className="hidden sm:inline">Insluiten</span>
          </button>

          <button
            onClick={handleToggleFullscreen}
            className="hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer transition-colors"
            title="Volledig scherm weergave"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">Volledig scherm</span>
          </button>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-main)] flex items-center gap-1 transition-colors"
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
