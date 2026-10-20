# NS Treinen & Bus-Trein Aansluitingsanalyse Station Steenwijk

Realtime weergave van NS treinen (Intercity & Sprinter) door de corridor Steenwijkerland, gecombineerd met een geautomatiseerde aansluitingsanalyse op station Steenwijk. Het systeem berekent en registreert of reizigers hun overstap (3 minuten loopmarge, 3–15 min geplande koppeling) daadwerkelijk halen, uitgesplitst per buslijn, dag, week en maand.

> [!IMPORTANT]
> **Behoud van bestaande data:** De bestaande bus-punctualiteitslogs (`punctualityLogs.json` en backups) en deelfietslogs blijven volledig onaangeroerd. Aansluitingsmetingen worden opgeslagen in een dedicated, additief opslagsysteem (`transferLogs.json` en `transferLogs.backup.json`).

---

## User Review & Bevestigde Keuzes

- **Plaatsing in de Interface**: Dedicated tabblad **"Aansluitingen"** in de hoofdnavigatie, voorzien van KPI-kaarten, lijndiagrammen/voortgangsmeters en een gedetailleerde overstaptabel.
- **Treinbereik**: Zowel Sprinters als Intercity-treinen in beide richtingen (Spoor 1 richting Zwolle/Randstad en Spoor 2 richting Leeuwarden).
- **Visuele Weergave op Kaart**: Blauwe spooricoon-markers met treinserie (`IC 836`, `SPR 9036`), richting en actuele vertragingsstatus (+2 min / Op tijd), inclusief filteroptie in de kaart-knoppenbalk.
- **Overstaplogica**:
  - Gepland koppelvenster: Bus arriveert volgens dienstregeling **tussen 3 en 15 minuten vóór het geplande vertrek** van de trein.
  - Minimale overstaptijd: **3 minuten** loopmarge tussen *Halte Busstation Steenwijk (Stationsplein)* en *Halte Treinstation Steenwijk (Spoorpad)*.
  - Realtime beoordeling: $(\text{Actueel vertrek trein}) - (\text{Actuele aankomst bus}) \ge 3 \text{ min} \implies \text{Gehaald}$, anders $\text{Gemist}$. Bij busuitval of treinuitval geldt direct $\text{Gemist}$.

---

## 1. Overview & Core Concept

De gemeente Steenwijkerland fungeert via station Steenwijk als regionaal overstapknooppunt voor buslijnen (zoals lijn 70 Giethoorn/Zwartsluis, lijn 26 Meppel, lijn 214 Lelystad, buurtbus 524) naar de spoorcorridor Leeuwarden–Zwolle. Deze uitbreiding biedt beleidsmakers en reizigers inzicht in de betrouwbaarheid van overstappen op basis van realtime GTFS-RT en DRGL data.

---

## 2. User Experience & Visual Design

### A. Dedicated Aansluitingen Dashboard
Het dashboard volgt het **Premium Forensic Dark** ontwerpsysteem (`--bg-main: #060e0a`, `--bg-card: #0b1a13`, `--border-subtle: #1b3829`, goudaccenten `--accent-gold: #f59e0b`):
- **KPI-Strook**:
  1. *Totaal geplande aansluitingen* (gebaseerd op 3-15 min venster)
  2. *Aansluitingen gehaald* (aantal en succespercentage in `--status-emerald`)
  3. *Aansluitingen gemist* (aantal en faalpercentage in `--status-crimson`)
  4. *Gemiddelde effectieve overstaptijd* (in minuten)
- **Tijds- en Lijnfilters**:
  - Tijdsvenster: *Vandaag*, *Deze Week (ISO)*, *Deze Maand*, *Historisch Totaal*
  - Lijnselector: *Alle buslijnen* of specifiek (Lijn 70, Lijn 26, Lijn 214, Lijn 524, Lijn 18, Lijn 20)
  - Statusfilter: *Alles*, *Alleen Gemist*, *Alleen Gehaald*
- **Lijnprestatie Matrix**:
  - Overzichtstabel per buslijn met totaal aantal aansluitingen, gehaald %, gemist %, en primaire verliesoorzaak (busvertraging vs treinuitval).
  - Getallen uitgelijnd via `font-variant-numeric: tabular-nums`.
- **Forensische Logtabel**:
  - Chronologische lijst van alle gedetecteerde overstapparen met geplande tijden, realtime vertragingen van zowel bus als trein, restmarge en definitief oordeel (*Gehaald* / *Gemist*).

### B. Live Treinmarkers op de Kaart
- **Kaartbediening**: Nieuwe toggle `Treinen` naast `Voertuigen (Bussen)` en `Deelfietsen`.
- **Marker Design**: Onderscheidend blauw spoorwegicoon (`--status-blue: #38bdf8`) met een compact label met treinserie (bijv. `IC 836` of `SPR 9036`), rijsnelheid en stiptheidskleur.
- **Trein Popup**: Bij aanklikken toont de popup ritdetails: serie, eindbestemming, materieeltype en actuele vertraging.

---

## 3. Technische Architectuur & Dataflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATABRONNEN (REALTIME)                           │
│  OVzoeker GTFS-RT Snapshot          DRGL / OVzoeker Station Departures     │
│  - Live bussen (EBS, Qbuzz, etc.)   - Busstation Steenwijk (Stationsplein)  │
│  - Live treinen (NS corridor)       - Treinstation Steenwijk Spoor 1 & 2    │
└──────────────────────┬──────────────────────────────────────┬───────────────┘
                       │                                      │
                       ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXPRESS BACKEND (server.ts)                      │
│                                                                             │
│  1. Vehicle Poller:                                                         │
│     - Filtert bussen in Steenwijkerland polygoon                            │
│     - Filtert NS treinen op spoorcorridor Meppel ⇔ Steenwijk ⇔ Wolvega      │
│                                                                             │
│  2. Transfer Matching Engine:                                               │
│     - Detecteert busaankomsten en treinvertrekken op station Steenwijk      │
│     - Identificeert paren met 3 min <= delta gepland <= 15 min              │
│     - Evalueert effectieve overstapmarge (Trein_actueel - Bus_actueel)      │
│     - Registreert 'gehaald' (marge >= 3m) of 'gemist' (marge < 3m)         │
│                                                                             │
│  3. Additive Persistence Store:                                             │
│     - src/data/transferLogs.json (met automatische .backup.json)            │
│     - Geen mutatie van bestaande punctualityLogs.json                       │
│                                                                             │
│  4. REST Endpoints:                                                         │
│     - GET /api/treinen (actuele NS treinen in corridor)                     │
│     - GET /api/transfers (statistieken & logs per dag/week/maand/lijn)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React SPA)                             │
│                                                                             │
│  - App.tsx: Tab-navigatie (Kaart, Vertrektijden, Aansluitingen, Fietsen)   │
│  - TransferDashboard.tsx: Dedicated KPI's, filterknoppen, lijntabellen     │
│  - MapView.tsx: Blauwe NS spoorwegmarkers + popup inspectie                │
│  - Zero-pill styling & tabular figures conform forensic dark standaard      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Gedetailleerde Implementatiestappen

1. **Backend Datamodellering (`server.ts` & `src/types`)**:
   - Definiëren van `TransferLogEntry`:
     ```typescript
     interface TransferLogEntry {
       id: string;
       timestamp: string;
       date: string;       // YYYY-MM-DD
       isoYear: number;
       isoWeek: number;    // ISO weeknummer
       yearMonth: string;  // YYYY-MM
       busLine: string;
       busOperator: string;
       busOrigin: string;
       busPlannedArrival: string;
       busActualArrival: string;
       busDelayMinutes: number;
       busCancelled: boolean;
       trainSeries: string;
       trainType: 'Intercity' | 'Sprinter';
       trainDestination: string;
       trainPlatform: string;
       trainPlannedDeparture: string;
       trainActualDeparture: string;
       trainDelayMinutes: number;
       trainCancelled: boolean;
       plannedMarginMinutes: number;  // 3 .. 15 min
       actualMarginMinutes: number;   // trainActual - busActual
       transferSuccess: boolean;      // actualMargin >= 3 && !cancelled
       missedReason?: 'bus_delayed' | 'bus_cancelled' | 'train_early_departed' | 'train_cancelled';
     }
     ```
   - Creëren van `loadTransferStore()` en `saveTransferStore()` met veilige write-to-temp en `.backup.json` garantie.

2. **Backend Realtime Engine & Polling**:
   - Periodieke synchronisatie van actuele trein- en busaankomsten/vertrekken op station Steenwijk via `https://ovzoeker.nl/api/arrivals/2993931` (Spoor 1) en `2993932` (Spoor 2) en de bushalte vertrektijden `NL:S:16301010`.
   - Matching algoritme dat aankomende bussen linkt aan vertrekkende treinen binnen het venster van 3–15 minuten.
   - Actuele NS treinen uitlezen uit de ovzoeker snapshot corridor rond Steenwijkerland (lat `52.70` - `52.88`, lng `6.05` - `6.20`).
   - Blootstellen van endpoints:
     - `GET /api/treinen`: Actuele rijdende treinen in Steenwijkerland.
     - `GET /api/transfers`: Gefilterde overstapstatistieken en logs.

3. **Frontend Componenten & Styling**:
   - Nieuwe component `src/components/TransferDashboard.tsx`:
     - KPI-kaarten voor totaal, gehaald, gemist, slagingspercentage.
     - Periode-schakelaar (Vandaag, Deze Week, Deze Maand, Alles).
     - Lijnen-filter en status-filter.
     - Samenvattingstabel per buslijn met voortgangsindicatoren.
     - Gedetailleerde logtabel met badge-vrije typografische layout en `tabular-nums`.
   - Kaartintegratie (`src/components/MapView.tsx`):
     - Blauwe spooricoon-markers voor rijdende treinen in de corridor.
     - Kaart-toggle voor treinen in de toolbar.
   - Navigatie (`src/App.tsx`):
     - Toevoegen van het tabblad "Aansluitingen" in de navigatiebalk met strakke architecturale styling (`border-radius: 4px - 6px`, zero pills).

4. **Verificatie & Testen**:
   - Controleer of de persistente JSON-opslag correct initialiseert zonder bestaande logs te overschrijven.
   - Controleer of de overstapberekening exact klopt (bijv. 10:03 bus aankomst om 10:09 (+6 min) naar 10:09 trein vertrekkend om 10:14 (+5 min) = 5 min marge $\ge 3$ min $\implies$ gehaald).
   - Validatie van de build met `compile_applet` en linting.
