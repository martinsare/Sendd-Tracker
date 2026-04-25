export type AvailabilityStatus = "available" | "partial" | "not_available";

export type AvailabilityMetric = {
  id: string;
  label: { en: string; cy: string };
  status: AvailabilityStatus;
  explanation: { en: string; cy: string };
  sourceLinks: Array<{ label: string; url: string }>;
};

export const availabilityMetrics: AvailabilityMetric[] = [
  {
    id: "ms_lookup",
    label: { en: "Find MS by postcode/constituency", cy: "Dod o hyd i AS drwy god post/etholaeth" },
    status: "partial",
    explanation: {
      en: "Postcode lookup uses MapIt to identify Senedd constituency/region, then matches to elected MSs from Senedd Business election results. Returns both the constituency MS and the regional MSs.",
      cy: "Mae chwilio trwy god post yn defnyddio MapIt i adnabod etholaeth/rhanbarth y Senedd, ac yna’n paru â’r ASau etholedig o ganlyniadau etholiad Busnes y Senedd. Mae’n dychwelyd AS yr etholaeth a’r ASau rhanbarthol."
    },
    sourceLinks: [
      { label: "MapIt (postcode -> areas)", url: "https://mapit.mysociety.org/" },
      { label: "Senedd Business election results", url: "https://business.senedd.wales/mgwebservice.asmx?op=GetElectionResults" }
    ]
  },
  {
    id: "spoken_contributions",
    label: { en: "Spoken contributions (plenary)", cy: "Cyfraniadau llafar (cyfarfod llawn)" },
    status: "partial",
    explanation: {
      en: "Implemented for recent plenary sessions only: the backend parses official XML transcript exports and extracts per‑member spoken contribution snippets using conservative name matching with confidence labels.",
      cy: "Wedi ei weithredu ar gyfer sesiynau cyfarfod llawn diweddar yn unig: mae’r cefnben yn parsio allforion XML swyddogol a’n echdynnu darnau o gyfraniadau llafar fesul aelod gan ddefnyddio paru enwau ceidwadol gyda labeli hyder."
    },
    sourceLinks: [
      { label: "Record of Proceedings (XML Export)", url: "https://record.senedd.wales/XMLExport" },
      { label: "Record of Proceedings (web)", url: "https://record.senedd.wales/" }
    ]
  },
  {
    id: "topic_classification",
    label: { en: "Topic classification", cy: "Dosbarthiad pynciau" },
    status: "partial",
    explanation: {
      en: "Implemented using simple keyword matching on transcript snippets (no AI). This may not fully reflect intent, and should be treated as a journalism hint rather than a definitive label.",
      cy: "Wedi ei weithredu drwy baru eiriau allweddol syml ar ddarnau trawsgrifiad (dim AI). Efallai na fydd hyn yn adlewyrchu’r bwriad yn llawn, a dylid ei drin fel awgrym newyddiaduraeth yn hytrach na label pendant."
    },
    sourceLinks: [{ label: "Record of Proceedings (XML Export)", url: "https://record.senedd.wales/XMLExport" }]
  },
  {
    id: "attendance",
    label: { en: "Attendance", cy: "Presenoldeb" },
    status: "not_available",
    explanation: {
      en: "Not available / not verified in this MVP. Senedd Tracker intentionally reports recorded participation, not attendance, unless a reliable official dataset is verified.",
      cy: "Ddim ar gael / heb ei ddilysu yn yr MVP hwn. Mae Senedd Tracker yn adrodd ar gyfranogiad wedi ei gofnodi, nid presenoldeb, oni bai bod set ddata swyddogol ddibynadwy wedi ei ddilysu."
    },
    sourceLinks: [{ label: "Record of Proceedings", url: "https://record.senedd.wales/" }]
  },
  {
    id: "votes_divisions",
    label: { en: "Votes/divisions", cy: "Pleidleisiau/rhaniadau" },
    status: "partial",
    explanation: {
      en: "Implemented for recent plenary sessions only: the backend parses official vote exports and links per‑member vote results to MS profiles. Coverage is partial and limited to indexed meetings.",
      cy: "Wedi ei weithredu ar gyfer sesiynau cyfarfod llawn diweddar yn unig: mae’r cefnben yn parsio allforion pleidleisio swyddogol ac yn cysylltu canlyniadau pleidleisio fesul aelod â phroffiliau AS. Mae’r cwmpas yn rhannol ac yn gyfyngedig i gyfarfodydd sydd wedi’u mynegeio."
    },
    sourceLinks: [{ label: "Record of Proceedings (XML Export)", url: "https://record.senedd.wales/XMLExport" }]
  },
  {
    id: "committee_involvement",
    label: { en: "Committee involvement", cy: "Cymryd rhan mewn pwyllgorau" },
    status: "not_available",
    explanation: {
      en: "Not implemented in the MVP yet. Committee membership/meetings can likely be derived from Senedd Business data sources, but needs verification and careful modelling.",
      cy: "Heb ei weithredu yn yr MVP eto. Gellid deillio aelodaeth/cyfarfodydd pwyllgor o ffynonellau Busnes y Senedd, ond mae angen dilysu a modelu gofalus."
    },
    sourceLinks: [{ label: "Senedd Open Data", url: "https://senedd.wales/help/open-data/" }]
  },
  {
    id: "questions_motions",
    label: { en: "Questions or motions", cy: "Cwestiynau neu gynigion" },
    status: "not_available",
    explanation: {
      en: "Not implemented in the MVP yet. This requires verifying a stable public source and defining how items are attributed to an MS.",
      cy: "Heb ei weithredu yn yr MVP eto. Mae hyn yn gofyn am ddilysu ffynhonnell gyhoeddus sefydlog a diffinio sut mae eitemau’n cael eu priodoli i AS."
    },
    sourceLinks: [{ label: "Senedd Open Data", url: "https://senedd.wales/help/open-data/" }]
  }
];
