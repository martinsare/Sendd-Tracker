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
    status: "partial",
    explanation: {
      en: "Partial: committee meeting attendance is derived from official Senedd Business meeting information (attendee lists). Plenary attendance is not reliably recorded in this feed and is not treated as definitive attendance.",
      cy: "Yn rhannol: deillir presenoldeb cyfarfodydd pwyllgor o wybodaeth swyddogol am gyfarfodydd ar Busnes y Senedd (rhestrau mynychwyr). Nid yw presenoldeb cyfarfod llawn yn cael ei gofnodi’n ddibynadwy yn y ffrwd hon ac ni chaiff ei drin fel presenoldeb pendant."
    },
    sourceLinks: [
      // The attendance page requires a meeting `ID=`. Provide a stable example rather than the error page.
      { label: "Senedd Business meeting attendance (example)", url: "https://business.senedd.wales/mgMeetingAttendance.aspx?ID=15766" },
      { label: "Senedd Business meeting info (GetMeeting)", url: "https://business.senedd.wales/mgwebservice.asmx?op=GetMeeting" },
      { label: "Senedd Business meeting list (GetAllMeetingsByDate)", url: "https://business.senedd.wales/mgwebservice.asmx?op=GetAllMeetingsByDate" }
    ]
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
    status: "partial",
    explanation: {
      en: "Partial: recent committee meetings are indexed from official Senedd Business meeting information and matched to Members via Senedd numeric IDs when present in attendee lists. Coverage is limited to indexed meetings and does not claim complete committee membership.",
      cy: "Yn rhannol: mynegeir cyfarfodydd pwyllgor diweddar o wybodaeth swyddogol am gyfarfodydd ar Busnes y Senedd ac fe’u paru â’r Aelodau drwy ID rhifiadol y Senedd pan fo ar gael mewn rhestrau mynychwyr. Mae’r cwmpas wedi ei gyfyngu i gyfarfodydd sydd wedi’u mynegeio ac nid yw’n honni aelodaeth bwyllgor gyflawn."
    },
    sourceLinks: [
      { label: "Senedd Business meeting info (GetMeeting)", url: "https://business.senedd.wales/mgwebservice.asmx?op=GetMeeting" },
      { label: "Senedd Business meeting list (GetAllMeetingsByDate)", url: "https://business.senedd.wales/mgwebservice.asmx?op=GetAllMeetingsByDate" },
      { label: "Senedd Business committees (GetCommittees)", url: "https://business.senedd.wales/mgwebservice.asmx?op=GetCommittees" }
    ]
  },
  {
    id: "questions_motions",
    label: { en: "Questions or motions", cy: "Cwestiynau neu gynigion" },
    status: "partial",
    explanation: {
      en: "Partial: questions/motions are inferred from official plenary transcript headings when extracting per-member contributions. This does not yet include separate datasets for written questions or all motions outside indexed plenary exports.",
      cy: "Yn rhannol: deillir cwestiynau/cynigion o benawdau swyddogol trawsgrifiadau cyfarfod llawn wrth echdynnu cyfraniadau fesul aelod. Nid yw hyn eto’n cynnwys setiau data ar wahân ar gyfer cwestiynau ysgrifenedig neu bob cynnig y tu allan i’r allforion cyfarfod llawn sydd wedi’u mynegeio."
    },
    sourceLinks: [{ label: "Record of Proceedings (XML Export)", url: "https://record.senedd.wales/XMLExport" }]
  }
];
