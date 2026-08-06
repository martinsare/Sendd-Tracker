---
name: Participation API shape
description: The exact response shape the /api/members/[id]/participation route must return; MemberPage.tsx depends on this precisely
---

## Required response shape
```ts
{
  memberId: string;
  lastUpdatedAt: string | null;
  real: {
    implemented: boolean;
    partial: boolean;
    items: ParticipationItem[];   // spoken + votes merged, sorted by occurredAt DESC
    dataNotes: string[];          // keys like "limited_to_recent_plenary_exports"
    topicClassificationNote: string;
  };
  summary: {
    totalContributions: number;   // speech/question/motion count only
    contributionsLast30Days: number;
    mostActiveMonth: string;
    topTopics: string[];
    topicBreakdown: Array<{ topic: string; count: number }>;
    activityLevel: "Low" | "Moderate" | "High";
  };
  committees?: {
    implemented: boolean;
    partial: boolean;
    daysBack: number;
    totalMeetingsFound: number;
  };
}
```

## ParticipationItem shapes
- Speech: `{ id: "spoken:meetingId:contribId", kind: "speech"|"question"|"motion", topics, primaryTopic, ... }`
- Vote: `{ id: "vote:meetingId:contribId", kind: "vote", vote: { memberResult, memberResultRaw, overallEn, overallCy, totals }, ... }`
- Committee: `{ id: "committee:meetingId:memberId", kind: "committee", committee: { ... }, ... }`

**Why:** MemberPage.tsx (in `app/member/[id]/page.tsx`) unpacks this shape directly. A different shape causes silent empty state or crashes. The migrated participation route was rewritten to match the original backend's `handleParticipation()` function output.
