# Senedd Tracker

Full-stack civic dashboard that lets users look up their Member of the Senedd (MS) by postcode or constituency/region name and view recorded participation with transparent data availability and official source links.

## Stack

- **Frontend**: React 18 + Vite (port 5000)
- **Backend**: Node.js + Express API (port 5174)
- **Database**: SQLite (`backend/data/senedd-tracker.sqlite`) — created automatically on first run

## Running the app

```bash
npm run dev
```

This starts both backend and frontend concurrently via `concurrently`.

- Frontend (Vite): http://localhost:5000
- Backend health check: http://localhost:5174/api/health

## Project structure

```
backend/   Express API + SQLite cache + extractors
frontend/  React (Vite) UI (bilingual-ready EN/CY)
```

## Environment variables

Optional overrides go in `backend/.env` (copy from `backend/.env.example`):

```
PORT=5174
DB_PATH=./data/senedd-tracker.sqlite
CACHE_TTL_SECONDS=86400
```

No external API keys are required. The app uses public sources (MapIt, Senedd Business, Senedd Record of Proceedings).

## User preferences

<!-- Add any user-specified conventions or preferences here -->
