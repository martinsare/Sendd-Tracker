# Senedd Tracker

Full-stack civic dashboard that lets users look up their Member of the Senedd (MS) by postcode or constituency/region name and view recorded participation with transparent data availability and official source links.

## Stack

- **Framework**: Next.js 15 (App Router) — API routes + React frontend in one project
- **Database**: Replit-managed PostgreSQL (auto-provisioned, `DATABASE_URL` env var)
- **External data**: TheyWorkForYou API (`TWFY_API_KEY` secret) + MapIt + Senedd Record of Proceedings

## Running the app

```bash
npm run dev
```

Starts Next.js on port 5000. Both the API routes and the UI are served from the same process.

- Frontend: http://localhost:5000
- API health check: http://localhost:5000/api/health

## Project structure

```
app/              Next.js App Router
  api/            API route handlers (replaces the old Express backend)
    health/       GET /api/health
    search/       GET /api/search?q=...
    members/[id]/ GET /api/members/:id
      photo/      GET /api/members/:id/photo
      participation/ GET /api/members/:id/participation
    refresh/      POST /api/refresh
    record/       GET /api/record/plenary/exports
    data-availability/ GET /api/data-availability
    spoken/       GET /api/spoken/:meetingId/:contributionId
  member/[id]/    Member detail page
  data/           Data availability page
  layout.tsx      Root layout + metadata
  globals.css     Global styles
components/       Shared React components (Shell, MemberAvatar, Providers, Logo)
contexts/         React contexts (I18n, Theme, Toast)
lib/              Shared server-side logic
  db.ts           PostgreSQL pool (uses DATABASE_URL)
  httpCache.ts    HTTP caching layer (stores in http_cache table)
  env.ts          Environment variable accessors
  api.ts          Typed API client for use in client components
  sources/        External API clients (twfy.ts, mapit.ts, record.ts)
  services/       Business logic (memberDirectory.ts)
  extract/        Data extractors (spokenContributions.ts, votes.ts)
  analysis/       Data analysis (topics.ts)
  i18n/           Translations (translations.ts)
```

## Environment variables & secrets

| Key | Type | Notes |
|-----|------|-------|
| `DATABASE_URL` | Auto | Replit-managed PostgreSQL — do not set manually |
| `TWFY_API_KEY` | Secret | TheyWorkForYou API key (set via Replit Secrets) |
| `CACHE_TTL_SECONDS` | Optional env var | Default: 86400 (24 hours) |

No other external credentials are required. MapIt and Senedd Record of Proceedings are public APIs.

## Database schema

The schema is applied via `CodeExecution` / `executeSql`. Tables:
- `http_cache` — caches upstream HTTP responses
- `members` — MS directory (seeded from TheyWorkForYou on first search)
- `plenary_transcripts` — indexed plenary transcript exports
- `plenary_votes` — indexed plenary vote exports
- `spoken_contributions` — extracted spoken contributions per member
- `member_votes` — extracted vote records per member

## User preferences

<!-- Add any user-specified conventions or preferences here -->
