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
    status: "available",
    explanation: {
      en: "Live lookup powered directly by the TheyWorkForYou API (getMSs / getMS). Returns all active MSs for any Welsh constituency, region, or postcode.",
      cy: "Chwilio byw wedi'i bweru'n uniongyrchol gan API TheyWorkForYou (getMSs / getMS). Yn dychwelyd pob AS gweithredol ar gyfer unrhyw etholaeth, rhanbarth, neu god post yng Nghymru.",
    },
    sourceLinks: [
      { label: "TheyWorkForYou API (getMSs)", url: "https://www.theyworkforyou.com/api/getMSs" },
      { label: "TheyWorkForYou API (getMS)", url: "https://www.theyworkforyou.com/api/getMS" },
    ],
  },
  {
    id: "spoken_contributions",
    label: { en: "Spoken contributions & Debates (Senedd)", cy: "Cyfraniadau llafar a Dadleuon (Senedd)" },
    status: "available",
    explanation: {
      en: "Indexed directly via the TheyWorkForYou API (getDebates?type=senedd). Provides complete verified speeches, debate topics, questions, and dates with direct links to TheyWorkForYou transcripts.",
      cy: "Wedi'u mynegeio'n uniongyrchol trwy API TheyWorkForYou (getDebates?type=senedd). Yn darparu areithiau wedi'u dilysu, pynciau dadlau, cwestiynau, a dyddiadau gyda dolenni uniongyrchol i drawsgrifiadau TheyWorkForYou.",
    },
    sourceLinks: [
      { label: "TheyWorkForYou Debates API", url: "https://www.theyworkforyou.com/api/getDebates?type=senedd" },
      { label: "Senedd Record of Proceedings", url: "https://record.senedd.wales/" },
    ],
  },
  {
    id: "topic_classification",
    label: { en: "Topic classification", cy: "Dosbarthiad pynciau" },
    status: "available",
    explanation: {
      en: "Categorises debate speeches and questions into key policy areas (Health, Economy, Transport, Education, Climate, Welsh Language) using topic detection.",
      cy: "Yn dosbarthu areithiau a chwestiynau i feysydd polisi allweddol (Iechyd, Economi, Trafnidiaeth, Addysg, Hinsawdd, Iaith Gymraeg) gan ddefnyddio canfod pynciau.",
    },
    sourceLinks: [
      { label: "TheyWorkForYou Debates", url: "https://www.theyworkforyou.com/senedd/" },
    ],
  },
  {
    id: "votes_divisions",
    label: { en: "Votes/divisions", cy: "Pleidleisiau/rhaniadau" },
    status: "partial",
    explanation: {
      en: "Plenary votes and divisions indexed from official Senedd vote exports and linked to MS profiles.",
      cy: "Pleidleisiau a rhaniadau cyfarfod llawn wedi'u mynegeio o allforion pleidleisio swyddogol y Senedd ac wedi'u cysylltu â phroffiliau AS.",
    },
    sourceLinks: [
      { label: "Record of Proceedings (XML Export)", url: "https://record.senedd.wales/XMLExport" },
    ],
  },
];
