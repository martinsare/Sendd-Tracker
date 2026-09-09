# Senedd Tracker (Civic Accountability Platform)

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev/)
[![Convex Cloud](https://img.shields.io/badge/Database-Convex%20Cloud-orange?style=flat)](https://www.convex.dev/)
[![Bilingual](https://img.shields.io/badge/Bilingual-Welsh%20%2F%20English-green?style=flat)](#bilingual-welsh---english-parity)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

**Senedd Tracker** is an open-source civic transparency platform designed to bridge the gap between complex parliamentary open data and public understanding in Wales. 

Built as an MSc dissertation project in **Computational & Data Journalism at Cardiff University**, the platform enables citizens to discover their elected Members of the Senedd (MSs) through multi-modal search (Welsh postcode, city name in Welsh/English, or politician name), inspect longitudinal career tenures, analyze policy-categorized debate speeches, and track chamber voting divisions.

---

## Key Features

### 1. Multi-Modal Representation Discovery (`/api/search`)
- **Proportional Representation**: Given a Welsh postcode (e.g. `CF10 1EP`, `CF37 2PU`), resolves both the 1 local Constituency MS and the 4 Regional MSs representing that electoral region.
- **Bilingual City & Area Search**: Searches by town/city names with automatic Welsh/English synonym mapping (e.g., `Caerdydd` <-> `Cardiff`, `Abertawe` <-> `Swansea`, `Casnewydd` <-> `Newport`, `Wrecsam` <-> `Wrexham`).
- **Politician Name Search**: Instant lookups by representative name (e.g., `Rhun ap Iorwerth`, `Eluned Morgan`, `Andrew RT Davies`).

### 2. Longitudinal Career History & Multi-Term Timeline (`/member/[id]#history`)
- Chronological career tracking mapping elected office across **Senedd Cymru** and the **UK House of Commons (Westminster)**.
- Surfaces service duration metrics (e.g., `Serving in elected office since 2013 (4 terms)`).
- Dignified civic fallback states for newly elected members with no previous terms on record.

### 3. Debate Intelligence & Senedd XML Ingestion (`/api/refresh`)
- Over **937+ verified plenary speeches and questions** indexed from official Senedd Record of Proceedings XML feeds (`record.senedd.wales/XMLExport`).
- **Weighted Topic Classifier Engine** (`lib/analysis/topics.ts`): Automatically categorizes speeches into *Health, Housing, Transport, Education, Economy, Welsh Language,* and *Environment*.
- **Verbatim Bilingual Speech Reader Modal**: In-app full-text reading experience with instant English/Welsh Hansard switching and deep links to Senedd.tv video feeds.

### 4. Adaptive State Rendering (Anti-Cliché UX)
- Replaces broken-looking empty boxes and negative zero counters (`0 in 30 days`) with positive verified achievements (*Total Plenary Transcripts, Primary Policy Focus, Live Senedd XML Verified Badge*).
- Clear civic disclosures explaining that formal roll-call divisions occur only when challenged on the Senedd floor.

### 5. Open Data Audit & Error Shielding
- **Public Data Availability Dashboard (`/data`)**: Complete status transparency, upstream source disclosures, and direct XML links for every metric.
- **Administrative Error Logging (`/log` & `/logs`)**: Production error shielding that masks internal stack traces from public users (returning clean `ERR-XXXXXX` reference codes) while logging full payloads to Convex document tables for research auditing.
- **Bilingual Welsh/English Parity**: Full compliance with the Welsh Language (Wales) Measure 2011 without automated/machine-translated political discourse.

---

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the project root:
```env
PORT=5000
TWFY_API_KEY=your_twfy_api_key_here
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## Production Deployment (Vercel)

1. Push code to your GitHub repository.
2. Import the repository on [vercel.com](https://vercel.com).
3. Under **Project Settings -> Environment Variables**, configure:
   - `TWFY_API_KEY`
   - `NEXT_PUBLIC_CONVEX_URL`
4. Click **Deploy**.

---

## Academic Context & Attribution

- **Author**: Martins Kolawole Are (Candidate ID: `C25070123`)
- **Institution**: Cardiff School of Journalism, Media & Culture (JOMEC), Cardiff University
- **Degree**: MSc in Computational & Data Journalism
- **Supervisor**: Aidan O'Donnell
- **Ethics Approval Reference**: `25/26COMPJ-25070123`

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
