# Senedd Tracker

A bilingual civic transparency web application to track Members of the Senedd (MSs) in Wales — their parliamentary speeches, voting participation, and committee activity.

**Live Platform**: [https://sendd-tracker.vercel.app](https://sendd-tracker.vercel.app)

---

## Features

- **Find Your Representatives**: Search by Welsh postcode, city/town name (in English or Welsh, e.g. _Cardiff_ / _Caerdydd_), or politician name.
- **Debate & Plenary Intelligence**: Read official Senedd speeches categorized by policy topic (Health, Transport, Housing, Economy, etc.).
- **Member Profiles & Career Timelines**: View detailed career history, voting records, and committee roles.
- **Bilingual Support**: Fully accessible in both English and Welsh (_Cymraeg_).

---

## Tech Stack

- **Framework**: Next.js (App Router), React, TypeScript
- **Database**: Convex Cloud
- **Styling**: Modern CSS (Light/Dark mode support)
- **Data Sources**: Official Senedd Open Data & TheyWorkForYou API

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/martinsare/Sendd-Tracker.git
   cd Sendd-Tracker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file with your credentials:

   ```env
   PORT=5000
   TWFY_API_KEY=your_twfy_api_key_here
   NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   Visit [http://localhost:5000](http://localhost:5000).

---

## License

This project is licensed under the [MIT License](LICENSE).
