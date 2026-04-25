import type { Request, Response } from "express";

export function getDataAvailability(_req: Request, res: Response) {
  res.json({
    updatedAt: new Date().toISOString(),
    metrics: [
      {
        key: "member_lookup_by_postcode",
        label: "Member lookup by postcode",
        status: "available",
        explanation: "Uses Senedd ModernGov `GetCouncillorsByPostcode` to identify the MS/MSs for a postcode.",
        sourceLinks: ["https://business.senedd.wales/mgwebservice.asmx?op=GetCouncillorsByPostcode"]
      },
      {
        key: "member_lookup_by_constituency",
        label: "Member lookup by constituency/ward name",
        status: "partial",
        explanation:
          "Prototype: uses `GetCouncillorsByWard` where possible. Naming mismatches may require manual selection or future boundary mapping improvements.",
        sourceLinks: ["https://business.senedd.wales/mgwebservice.asmx?op=GetCouncillorsByWard"]
      },
      {
        key: "spoken_contributions_plenary",
        label: "Spoken contributions (Plenary)",
        status: "partial",
        explanation:
          "MVP only lists recent Plenary transcript exports and links to official sources. Per‑member extraction requires additional XML parsing/ID matching work.",
        sourceLinks: ["https://record.senedd.wales/XMLExport", "https://record.senedd.wales/"]
      },
      {
        key: "votes_divisions",
        label: "Votes / divisions",
        status: "partial",
        explanation:
          "Votes are linked when available via the XML export listings. Normalising votes per member is not yet fully implemented in this MVP.",
        sourceLinks: ["https://record.senedd.wales/XMLExport"]
      },
      {
        key: "committees",
        label: "Committee involvement",
        status: "not_verified",
        explanation:
          "Not implemented in this MVP. Committee data sources exist but need verification and mapping to members before presenting metrics.",
        sourceLinks: ["https://senedd.wales/help/open-data/"]
      },
      {
        key: "questions_and_motions",
        label: "Questions / motions",
        status: "not_verified",
        explanation:
          "Not implemented in this MVP. Requires verification of reliable public feeds and consistent member identifiers.",
        sourceLinks: ["https://senedd.wales/help/open-data/"]
      }
    ]
  });
}

