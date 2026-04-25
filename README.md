# Senedd Tracker (MVP)

Full-stack civic data dashboard MVP that helps users look up their Member of the Senedd (MS) by postcode or constituency/region name and view **recorded participation** (not "attendance"), with transparent data availability and source links.

## Tech
- React (Vite) frontend
- Node.js + Express backend API
- SQLite (local) for caching and persistence

## Architecture (important)
- The React frontend **only** calls the backend (`/api/...`).
- The backend fetches from public sources, processes, caches to SQLite, and serves a clean API.
- The frontend does not call external APIs for translation; Welsh UI labels are manual, and political text is displayed only as provided by official sources.

## Architecture diagram (high level)

```
User browser
  |
  v
React UI (frontend)  ----->  Senedd Tracker API (backend)  ----->  Public sources
  |                               |                                  |
  |                               v                                  |
  |                           SQLite cache/db                         |
  |                               |                                  |
  +-------------------------------+----------------------------------+
        UI only calls backend              Backend fetches + caches
```

## Local setup
1. Install dependencies:
   - `npm install`
2. Start dev servers (backend + frontend):
   - `npm run dev`
3. Open:
   - Frontend: `http://localhost:5173`
   - Backend health: `http://localhost:5174/api/health`

## Project structure
- `backend/` Express API + SQLite cache + extractors
- `frontend/` React (Vite) UI (bilingual-ready)

## Backend API (MVP)
- `GET /api/health`
- `GET /api/search?q=...`
  - Postcode: uses MapIt to identify the Senedd constituency and region for the postcode
  - Then matches those areas to elected Members of the Senedd (MSs) using Senedd Business election results
  - Name/area search: searches the MS directory by member name, constituency, or region
- `GET /api/members/:id` (reads from SQLite member cache populated by searches)
- `GET /api/members/:id/participation`
  - Returns extracted spoken contributions (plenary) when available
  - If nothing is indexed yet, the UI shows an explicit "no verified recorded participation found" message (no fabricated participation is ever displayed)
- `GET /api/record/plenary/exports?limit=...` (links to official transcript/vote exports)
- `GET /api/data-availability` (transparency model used by the UI)

## SQLite schema
See `backend/schema.sql` (applied automatically on backend startup in `backend/src/db.ts`).

## Public sources used (via backend only)
- MapIt (mySociety): postcode -> Senedd constituency/region lookup.
- Senedd Business (ModernGov web service): election results used to build a directory of elected MSs (constituency and region).
- Senedd Record of Proceedings (`record.senedd.wales`): plenary transcript exports used for spoken contributions, plus official links for verification.

The MVP intentionally avoids claiming "attendance" and does not infer missing activity.
The system does not display fabricated participation data: if an item is visible in the dashboard, it must come from an official source link.

## Data pipeline (plain English)
1. Postcode input -> MapIt returns the Senedd constituency and region for that postcode.
2. Constituency/region -> Senedd Business election results provide the elected MS(s) for those areas.
3. Record of Proceedings exports -> the backend indexes recent plenary transcripts and extracts spoken contribution snippets by member name.
4. The dashboard displays only what is found in the indexed official sources, with source links and confidence labels.

## Spoken contributions extraction (implemented)
Senedd Tracker extracts **spoken contributions** (recorded participation) from official Senedd Record of Proceedings exports:
- Source: `record.senedd.wales/XMLExport` (Plenary transcript exports).
- Backend flow:
  - Fetch recent Plenary transcript export links
  - Download the official transcript XML (bilingual where available)
  - Extract contribution rows including `Member_name_English` and the official `contribution_verbatim`/`contribution_translated` text
  - Match speaker -> member using conservative name normalisation and a confidence label (`high|medium|low`)
  - Store extracted snippets in SQLite (`spoken_contributions`)
- Output: the member dashboard shows a timeline of real spoken contribution snippets with source links and confidence labels.

### Limitations (made explicit in the UI)
- Coverage is **partial**: only a small number of recent Plenary exports are indexed in the MVP.
- Matching is name-based (not an authoritative cross-ID mapping), so some items may be `medium`/`low` confidence or not attributed at all.
- The app does **not** auto-translate political text. It only displays the official transcript text provided in the export.

### Why this answers supervisor feedback about sources
This milestone uses a verified **official** source (Senedd Record of Proceedings exports) and keeps uncertainty visible (partial coverage + confidence labels), rather than implying full "attendance" or inventing metrics without a confirmed dataset.

## How this answers supervisor questions
### Welsh language production
- The interface is bilingual-ready from the start (English/Welsh UI labels).
- Political content is not auto-translated. For plenary contributions, the system uses the official bilingual transcript exports when available.
- Where Welsh/English official versions exist, the dashboard links to the official source for verification.

### Available data sources (and what they support)
- Postcode -> constituency/region: supported by MapIt.
- Constituency/region -> MSs: supported by Senedd Business election results.
- Recorded participation (spoken contributions): supported by Senedd Record of Proceedings transcript exports.
- Attendance: not shown (not verified as a complete dataset for this MVP).

## Live / continuous updates (dev/demo)
The MVP is designed to keep working beyond the dissertation with a simple refresh loop:
- The backend caches upstream downloads in SQLite (`http_cache`) using `CACHE_TTL_SECONDS`.
- The refresh endpoint re-indexes recent plenary transcript exports and inserts any **new** contributions:
  - `POST /api/refresh` with optional JSON body `{ "maxMeetings": 8, "force": false }`
  - Indexing is idempotent: contributions are stored with a uniqueness constraint and inserted with `INSERT OR IGNORE` (history is preserved; no duplicate rows).
- The frontend shows a `Last updated` timestamp and includes a `Refresh Data` button (dev/demo only) that calls `POST /api/refresh`.

### Historical preservation (MVP approach)
- Each stored contribution includes its date (`occurred_at`) and meeting reference (`meeting_id`) and is linked to a member (`member_id`).
- Refreshing does not overwrite or delete old contribution rows, allowing future extensions like new time periods or assemblies without losing earlier data.

## Environment variables
Create `backend/.env` if you want overrides (optional). You can start from `backend/.env.example`.
```
PORT=5174
DB_PATH=./data/senedd-tracker.sqlite
CACHE_TTL_SECONDS=86400
```

## Data transparency (dissertation requirement)
This MVP includes a **Data Availability** page that clearly labels what is:
- Available (implemented and sourced)
- Partially available (prototype / limited coverage)
- Not available / not verified (explicitly not implemented)

Political content is not auto-translated; the UI is bilingual-ready and links to official Welsh/English sources where available.

## Dissertation context (Computational & Data Journalism)
Senedd Tracker demonstrates:
- **Transparency**: every metric has a clear status and source links
- **Accessibility**: postcode/constituency search lowers barriers to civic information
- **Data-driven storytelling**: timelines/cards surface patterns of recorded participation
- **Civic technology**: a practical tool that can be extended as data sources are verified
