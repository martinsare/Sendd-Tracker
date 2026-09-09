# Chapter 3: System Design & Architectural Specification
## Project: Senedd Tracker (Dissertation Artifact)
*Author: Martins Are*  
*Target Environment: Next.js (App Router), Convex Cloud, TheyWorkForYou API, Senedd Record of Proceedings XML*

---

## 1. System Overview & Problem Statement
The Welsh Parliament (Senedd Cymru) represents citizens through a mixed-member proportional electoral system:
- **1 Constituency Member of the Senedd (MS)** representing the voter's local constituency.
- **4 Regional Members of the Senedd (MSs)** representing the voter's broader electoral region (5 regions across Wales).

### Core Objectives:
1. **Accurate Representation Discovery**: Given a Welsh postcode (e.g. `CF37 2PU`, `CF10 1EP`), resolve both the local constituency and region to present all 5 representing MSs.
2. **Plenary & Debate Transparency**: Surface authentic parliamentary speeches, oral/written questions, and voting divisions per MS.
3. **Bilingual Equity (Welsh & English)**: Comply with the Welsh Language Standards without machine-translating political discourse.
4. **Performance & Rate Limit Resilience**: Design a tiered hybrid caching model to operate within third-party API rate quotas (1,000 requests/day).

---

## 2. High-Level Architecture

```
                                  +---------------------------------------+
                                  |             Client UI                 |
                                  |   (Next.js App Router, SSR + React)   |
                                  +-------------------+-------------------+
                                                      |
                                             REST / Server Actions
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |         Next.js Backend Routes        |
                                  |     /api/search, /api/members/[id]    |
                                  +---------+-------------------+---------+
                                            |                   |
                        Tiered Cache & Persistence       External Upstream APIs
                                            |                   |
                     +----------------------+------+            |
                     |                             |            |
                     v                             v            v
        +-------------------------+   +-------------------+  +----------------------------------+
        | In-Memory Cache (RAM)   |   |   Convex Cloud    |  | 1. TheyWorkForYou API (MSs/Hansard)
        |  (Zero Latency Buffer)  |   |  - members        |  | 2. Senedd Record XML Exports
        +-------------------------+   |  - http_cache     |  +----------------------------------+
                                      |  - contributions  |
                                      |  - member_votes   |
                                      +-------------------+
```

---

## 3. Data Ingestion & API Integration Layer

### 3.1 Primary Data Providers
1. **TheyWorkForYou API (mySociety)**:
   - `getMS?postcode={postcode}`: Resolves Welsh postcodes directly into MS representatives.
   - `getMSs`: Syncs directory of all 96 Senedd members.
   - `getPerson?id={person_id}`: Biographical metadata and authentic high-resolution imagery.
   - `getMPInfo?id={person_id}`: Senedd Register of Interests (`person_regmem_senedd_en` / `person_regmem_senedd_cy`).
2. **Senedd Record of Proceedings XML Exports (`record.senedd.wales/XMLExport`)**:
   - Official parliamentary transcripts and division XML records.
   - Used for verified voting records (`For`, `Against`, `Abstain`, `Did Not Vote`).

### 3.2 Senedd Electoral Boundaries Resolver (`lib/geo/seneddRegions.ts`)
- Maps all 40 constituencies across the 5 Electoral Regions (South Wales Central, South Wales East, South Wales West, Mid & West Wales, North Wales).
- Ensures that every postcode query fetches both the primary Constituency MS and the 4 corresponding Regional MSs.

---

## 4. Database Schema & Storage Architecture (Convex Cloud)

Convex is utilized for real-time document storage, reactive data binding, and persistent caching.

### 4.1 Table Schemas (`convex/schema.ts`)
```typescript
// 1. Members Table
members: defineTable({
  id: v.string(),             // E.g. "twfy:26754"
  name: v.string(),
  party: v.optional(v.string()),
  area_name: v.string(),
  area_type: v.string(),      // "Constituency" | "Region"
  image_url: v.optional(v.string()),
  updated_at: v.number(),
}).index("by_member_id", ["id"]).index("by_name", ["name"])

// 2. HTTP Cache Table
http_cache: defineTable({
  cache_key: v.string(),      // SHA-256 hash
  url: v.string(),
  status: v.number(),
  response_body: v.string(),
  fetched_at: v.number(),
  expires_at: v.number(),
  source: v.string(),
}).index("by_cache_key", ["cache_key"]).index("by_expires_at", ["expires_at"])

// 3. Spoken Contributions Table
spoken_contributions: defineTable({
  meeting_id: v.number(),
  contribution_id: v.number(),
  member_id: v.string(),
  speaker_name: v.string(),
  occurred_at: v.string(),
  context_en: v.optional(v.string()),
  context_cy: v.optional(v.string()),
  snippet_en: v.string(),
  full_text_en: v.optional(v.string()),
  source_url: v.string(),
  confidence: v.string(),
}).index("by_member_id", ["member_id"]).index("by_occurred_at", ["occurred_at"])

// 4. Member Votes Table
member_votes: defineTable({
  meeting_id: v.number(),
  contribution_id: v.number(),
  member_id: v.string(),
  occurred_at: v.string(),
  vote_name_en: v.optional(v.string()),
  member_result: v.string(), // "for" | "against" | "abstain" | "did_not_vote"
  totals_for: v.optional(v.number()),
  totals_against: v.optional(v.number()),
  totals_abstain: v.optional(v.number()),
}).index("by_member_id", ["member_id"])
```

---

## 5. Tiered Caching & Consistency Strategy

To balance **data freshness** with **API quota preservation**:

| Data Type | TTL (Time-to-Live) | Justification |
| :--- | :--- | :--- |
| **Postcode / Constituency Mapping** | **7 Days** (`604,800s`) | Electoral boundaries and seat holders do not change day-to-day. |
| **Member Metadata & Avatars** | **7 Days** (`604,800s`) | Political parties and headshots are stable outside general elections. |
| **Plenary Speeches & Debates** | **1 Hour** (`3,600s`) | Plenary sessions take place on Tuesdays and Wednesdays; 1-hour cache captures same-day sessions without quota exhaustion. |
| **On-Demand User Sync** | **Bypass** | "Refresh Data" button enables instantaneous cache re-fetch. |

---

## 6. Topic Classification & Analysis Engine (`lib/analysis/topics.ts`)
Debate speeches and contributions are automatically categorized into policy domains:
- **Health** (NHS, GP, hospitals, public health)
- **Housing** (Rent, homelessness, social housing, planning)
- **Transport** (Rail, bus routes, 20mph limits, road infrastructure)
- **Education** (Curriculum, schools, teachers, universities)
- **Economy** (Jobs, inflation, business, energy)
- **Welsh Language** (Cymraeg, bilingual services, Welsh-medium education)
- **Environment** (Net Zero, flooding, biodiversity, renewable energy)

---

## 7. Security, Error Handling & Graceful Degradation
1. **Failover In-Memory Cache**: If the database is unreachable, queries fall back to an in-memory SHA-256 buffer.
2. **Hydration Protection**: Next.js layout implements `suppressHydrationWarning` to protect against client extension DOM injection.
3. **Type-Safe Validation**: All query parameters (`q`, `id`, `postcode`) are validated via `zod` schemas.

---
*Document automatically updated on system changes for dissertation chapter reference.*

