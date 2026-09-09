# Senedd Tracker (MVP)

Full-stack civic dashboard MVP that helps users look up their Member of the Senedd (MS) by postcode or constituency/region name and view **recorded participation** with transparent data availability and official source links.

## Tech

- React (Next.js 15) frontend & API routes
- TheyWorkForYou (TWFY) API for parliamentary debates & MS profiles
- Convex for reactive caching, cloud database, and persistence

## Architecture (important)

- The React frontend calls the backend (`/api/...`) and Convex.
- The backend fetches from public sources (TheyWorkForYou, MapIt), processes, caches to Convex, and serves a clean API.
- Welsh UI labels are bilingual and political text is displayed only as provided by official sources.

## Architecture diagram (high level)

```
User browser
  |
  v
Next.js UI (frontend)  ----->  Senedd Tracker API (backend)  ----->  Public sources (TWFY, MapIt)
  |                                   |                                     |
  |                                   v                                     |
  |                            Convex Database                              |
  |                                   |                                     |
  +-----------------------------------+-------------------------------------+
        UI only calls backend                 Backend fetches + caches
```

## Local setup

1. Install dependencies:
   - `npm install`
2. Start Convex:
   - `npx convex dev`
3. Start dev server:
   - `npm run dev`
4. Open:
   - App: `http://localhost:5000`
   - Backend health: `http://localhost:5000/api/health`

## Database schema

See `convex/schema.ts` for the typed Convex schema definition.

## Public sources used (via backend only)

- MapIt (mySociety): postcode -> Senedd constituency/region lookup.
- Senedd Business (ModernGov web service): election results used to build a directory of elected MSs (constituency and region).
- Senedd Record of Proceedings (`record.senedd.wales`): plenary transcript and vote exports used for per-member extraction, plus official links for verification.
- Senedd Business meeting information (`mgwebservice.asmx`): meeting lists and attendee data used for committee meeting attendance items.

The MVP avoids inferring missing activity. If an item is visible in the dashboard, it must come from a linked official source.
The system does not display fabricated participation data: if an item is visible in the dashboard, it must come from an official source link.

## Data pipeline (plain English)

1. Postcode input -> MapIt returns the Senedd constituency and region for that postcode.
2. Constituency/region -> Senedd Business election results provide the elected MS(s) for those areas.
3. Record of Proceedings exports -> the backend indexes recent plenary transcripts and votes, and extracts per-member items.
4. Senedd Business meeting info -> the backend indexes recent committee meetings and matches attendance where recorded.
5. The dashboard displays only what is found in indexed official sources, with source links and confidence labels.

## Spoken contributions extraction (implemented)

Senedd Tracker extracts **spoken contributions** (recorded participation) from official Senedd Record of Proceedings exports:

- Source: `record.senedd.wales/XMLExport` (Plenary transcript exports).
- Backend flow:
  - Fetch recent Plenary transcript export links
  - Download the official transcript XML (bilingual where available)
  - Extract contribution rows including `Member_name_English` and the official `contribution_verbatim`/`contribution_translated` text
  - Match speaker -> member using conservative name normalisation and a confidence label (`high|medium|low`)
  - Store extracted snippets in the database (`spoken_contributions`)
- Output: the member dashboard shows a timeline of real spoken contribution snippets with source links and confidence labels.

### Limitations (made explicit in the UI)

- Coverage is **partial**: only a limited number of recent meetings are indexed in the MVP (plenary + committee).
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
- Plenary contributions (incl. headings for questions/motions where explicit): supported by Senedd Record of Proceedings transcript exports.
- Plenary votes/divisions: supported by Senedd Record of Proceedings vote exports.
- Committee meeting attendance (where recorded): supported by Senedd Business meeting information (attendees list).
- Attendance (general/plenary): still **partial** and not treated as definitive attendance across all contexts.

## Live / continuous updates (dev/demo)

The MVP is designed to keep working beyond the dissertation with a simple refresh loop:

- The backend caches upstream downloads in the database (`http_cache`) using `CACHE_TTL_SECONDS`.
- The refresh endpoint re-indexes recent plenary transcript exports and inserts any **new** contributions:
  - `POST /api/refresh` with optional JSON body `{ "maxMeetings": 8, "force": false }`
  - Indexing is idempotent: contributions are stored with a uniqueness constraint and inserted with `INSERT OR IGNORE` (history is preserved; no duplicate rows).
- The frontend shows a `Last updated` timestamp and includes a `Refresh Data` button (dev/demo only) that calls `POST /api/refresh`.

### Historical preservation (MVP approach)

- Each stored contribution includes its date (`occurred_at`) and meeting reference (`meeting_id`) and is linked to a member (`member_id`).
- Refreshing does not overwrite or delete old contribution rows, allowing future extensions like new time periods or assemblies without losing earlier data.

## Environment variables

Set these in `.env`:

```
PORT=5174
SUPABASE_DB_URL=postgresql://postgres:...@db.your-project.supabase.co:5432/postgres
TWFY_API_KEY=...
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
