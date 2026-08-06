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
      en: "Postcode lookup uses MapIt to identify the Senedd constituency, then matches to elected MSs from the TheyWorkForYou API (getMSs). Returns all MSs for the matched constituency.",
      cy: "Mae chwilio trwy god post yn defnyddio MapIt i adnabod etholaeth y Senedd, ac yna'n paru â'r ASau etholedig o API TheyWorkForYou. Mae'n dychwelyd pob AS ar gyfer yr etholaeth a nodwyd.",
    },
    sourceLinks: [
      { label: "MapIt (postcode → areas)", url: "https://mapit.mysociety.org/" },
      { label: "TheyWorkForYou API (getMSs)", url: "https://www.theyworkforyou.com/api/getMSs" },
    ],
  },
  {
    id: "spoken_contributions",
    label: { en: "Spoken contributions (plenary)", cy: "Cyfraniadau llafar (cyfarfod llawn)" },
    status: "partial",
    explanation: {
      en: "Implemented for recent plenary sessions only: the backend parses official XML transcript exports and extracts per-member spoken contribution snippets using conservative name matching with confidence labels.",
      cy: "Wedi ei weithredu ar gyfer sesiynau cyfarfod llawn diweddar yn unig: mae'r cefnben yn parsio allforion XML swyddogol a'n echdynnu darnau cyfraniadau llafar fesul aelod.",
    },
    sourceLinks: [
      { label: "Record of Proceedings (XML Export)", url: "https://record.senedd.wales/XMLExport" },
      { label: "Record of Proceedings (web)", url: "https://record.senedd.wales/" },
    ],
  },
  {
    id: "topic_classification",
    label: { en: "Topic classification", cy: "Dosbarthiad pynciau" },
    status: "partial",
    explanation: {
      en: "Implemented using simple keyword matching on transcript snippets (no AI). This may not fully reflect intent.",
      cy: "Wedi ei weithredu drwy baru eiriau allweddol syml ar ddarnau trawsgrifiad (dim AI). Efallai na fydd hyn yn adlewyrchu'r bwriad yn llawn.",
    },
    sourceLinks: [{ label: "Record of Proceedings (XML Export)", url: "https://record.senedd.wales/XMLExport" }],
  },
  {
    id: "votes_divisions",
    label: { en: "Votes/divisions", cy: "Pleidleisiau/rhaniadau" },
    status: "partial",
    explanation: {
      en: "Implemented for recent plenary sessions only: the backend parses official vote exports and links per-member vote results to MS profiles.",
      cy: "Wedi ei weithredu ar gyfer sesiynau cyfarfod llawn diweddar yn unig: mae'r cefnben yn parsio allforion pleidleisio swyddogol ac yn cysylltu canlyniadau pleidleisio fesul aelod â phroffiliau AS.",
    },
    sourceLinks: [{ label: "Record of Proceedings (XML Export)", url: "https://record.senedd.wales/XMLExport" }],
  },
  {
    id: "questions_motions",
    label: { en: "Questions or motions", cy: "Cwestiynau neu gynigion" },
    status: "partial",
    explanation: {
      en: "Partial: questions/motions are inferred from official plenary transcript headings when extracting per-member contributions.",
      cy: "Yn rhannol: deillir cwestiynau/cynigion o benawdau swyddogol trawsgrifiadau cyfarfod llawn wrth echdynnu cyfraniadau fesul aelod.",
    },
    sourceLinks: [{ label: "Record of Proceedings (XML Export)", url: "https://record.senedd.wales/XMLExport" }],
  },
];
