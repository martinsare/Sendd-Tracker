# Senedd Tracker (Civic Accountability Platform)
# Senedd Tracker

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev/)
[![Convex Cloud](https://img.shields.io/badge/Database-Convex%20Cloud-orange?style=flat)](https://www.convex.dev/)
[![Bilingual](https://img.shields.io/badge/Bilingual-Welsh%20%2F%20English-green?style=flat)](#bilingual-welsh---english-parity)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
A bilingual civic transparency web application to track Members of the Senedd (MSs) in Wales — their parliamentary speeches, voting participation, and committee activity.

**Senedd Tracker** is an open-source civic transparency platform designed to bridge the gap between complex parliamentary open data and public understanding in Wales.
**Live Platform**: [https://sendd-tracker.vercel.app](https://sendd-tracker.vercel.app)

Built as an MSc dissertation project in **Computational & Data Journalism at Cardiff University**, the platform enables citizens to discover their elected Members of the Senedd (MSs) through multi-modal search (Welsh postcode, city name in Welsh/English, or politician name), inspect longitudinal career tenures, analyze policy-categorized debate speeches, and track chamber voting divisions.

---

## Key Features
## Features

### 1. Multi-Modal Representation Discovery (`/api/search`)
- **Find Your Representatives**: Search by Welsh postcode, city/town name (in English or Welsh, e.g. *Cardiff* / *Caerdydd*), or politician name.
- **Debate & Plenary Intelligence**: Read official Senedd speeches categorized by policy topic (Health, Transport, Housing, Economy, etc.).
- **Member Profiles & Career Timelines**: View detailed career history, voting records, and committee roles.
- **Bilingual Support**: Fully accessible in both English and Welsh (*Cymraeg*).

- **Proportional Representation**: Given a Welsh postcode (e.g. `CF10 1EP`, `CF37 2PU`), resolves both the 1 local Constituency MS and the 4 Regional MSs representing that electoral region.
- **Bilingual City & Area Search**: Searches by town/city names with automatic Welsh/English synonym mapping (e.g., `Caerdydd` <-> `Cardiff`, `Abertawe` <-> `Swansea`, `Casnewydd` <-> `Newport`, `Wrecsam` <-> `Wrexham`).
- **Politician Name Search**: Instant lookups by representative name (e.g., `Rhun ap Iorwerth`, `Eluned Morgan`, `Andrew RT Davies`).
---

### 2. Longitudinal Career History & Multi-Term Timeline (`/member/[id]#history`)
## Tech Stack

- Chronological career tracking mapping elected office across **Senedd Cymru** and the **UK House of Commons (Westminster)**.
- Surfaces service duration metrics (e.g., `Serving in elected office since 2013 (4 terms)`).
- Dignified civic fallback states for newly elected members with no previous terms on record.
- **Framework**: Next.js (App Router), React, TypeScript
- **Database**: Convex Cloud
- **Styling**: Modern CSS (Light/Dark mode support)
- **Data Sources**: Official Senedd Open Data & TheyWorkForYou API

### 3. Debate Intelligence & Senedd XML Ingestion (`/api/refresh`)

- Over **937+ verified plenary speeches and questions** indexed from official Senedd Record of Proceedings XML feeds (`record.senedd.wales/XMLExport`).
- **Weighted Topic Classifier Engine** (`lib/analysis/topics.ts`): Automatically categorizes speeches into _Health, Housing, Transport, Education, Economy, Welsh Language,_ and _Environment_.
- **Verbatim Bilingual Speech Reader Modal**: In-app full-text reading experience with instant English/Welsh Hansard switching and deep links to Senedd.tv video feeds.

### 4. Adaptive State Rendering (Anti-Cliché UX)

- Replaces broken-looking empty boxes and negative zero counters (`0 in 30 days`) with positive verified achievements (_Total Plenary Transcripts, Primary Policy Focus, Live Senedd XML Verified Badge_).
- Clear civic disclosures explaining that formal roll-call divisions occur only when challenged on the Senedd floor.

### 5. Open Data Audit & Error Shielding

- **Public Data Availability Dashboard (`/data`)**: Complete status transparency, upstream source disclosures, and direct XML links for every metric.
- **Administrative Error Logging (`/log` & `/logs`)**: Production error shielding that masks internal stack traces from public users (returning clean `ERR-XXXXXX` reference codes) while logging full payloads to Convex document tables for research auditing.
- **Bilingual Welsh/English Parity**: Full compliance with the Welsh Language (Wales) Measure 2011 without automated/machine-translated political discourse.

---

## Local Development Setup
## Getting Started

### 1. Install Dependencies
### Prerequisites
- Node.js 18+
- npm

```bash
npm install
```
### Installation

### 2. Configure Environment Variables
1. Clone the repository:
   ```bash
   git clone https://github.com/martinsare/Sendd-Tracker.git
   cd Sendd-Tracker
   ```

Create a `.env.local` file in the project root:
2. Install dependencies:
   ```bash
   npm install
   ```

```env
PORT=5000
TWFY_API_KEY=your_twfy_api_key_here
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```
3. Create a `.env.local` file with your credentials:
   ```env
   PORT=5000
   TWFY_API_KEY=your_twfy_api_key_here
   NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
   ```

### 3. Run Development Server
4. Start the development server:
   ```bash
   npm run dev
   ```
   Visit [http://localhost:5000](http://localhost:5000).

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
This project is licensed under the [MIT License](LICENSE).
