export type Locale = "en" | "cy";
export type TranslationKey = keyof typeof en;

const en = {
  // nav / shell
  appName: "Senedd Tracker",
  navHome: "Home",
  navData: "Data availability",
  tagline: "Track your Senedd representatives",
  searchPlaceholder: "Enter postcode or constituency (e.g. CF10 1EP)",
  searchButton: "Search",
  searching: "Searching…",
  recentSearches: "Recent searches",
  clearHistory: "Clear history",
  noResults: "No MSs found",
  tryDifferent: "Try a different postcode or constituency name.",
  yourMSs: "Your Members of the Senedd",
  for: "for",
  constituency: "Constituency",
  region: "Region",
  unknown: "Unknown",
  loading: "Loading…",
  error: "Error",
  retry: "Retry",
  back: "Back",
  close: "Close",
  openSource: "Source",
  openRecord: "Record of Proceedings",

  // member page
  memberNotFound: "Member not found",
  memberNotFoundDetail: "This member may not have been cached yet. Try searching first.",
  overview: "Overview",
  speeches: "Speeches",
  votes: "Votes",
  sources: "Sources",
  noSpeeches: "No speeches recorded yet.",
  noVotes: "No votes recorded yet.",
  refreshData: "Refresh data",
  refreshing: "Refreshing…",
  refreshSuccess: "Data refreshed.",
  refreshFailed: "Refresh failed — please try again.",
  party: "Party",
  area: "Constituency / Region",
  topTopics: "Top topics",
  topicBreakdown: "Topic breakdown",
  totalSpeeches: "Speeches recorded",
  totalVotes: "Votes recorded",
  read: "Read full speech",
  voteFor: "For",
  voteAgainst: "Against",
  voteAbstain: "Abstain",
  voteNoVote: "Did not vote",
  confidenceHigh: "High confidence match",
  confidenceMedium: "Medium confidence match",
  confidenceLow: "Low confidence match",
  page: "Page",
  next: "Next",
  prev: "Previous",
  loadMore: "Load more",

  // data availability page
  dataAvailabilityTitle: "Data availability",
  dataAvailabilityDesc:
    "This tracker is a prototype. Not all data about Senedd members is available. This page explains what is tracked and what is not.",
  statusAvailable: "Available",
  statusPartial: "Partial",
  statusNotAvailable: "Not available",

  // language toggle
  langToggle: "Cymraeg",

  // footer
  footerDisclaimer:
    "Senedd Tracker is an independent prototype and is not affiliated with the Senedd, Senedd Research, or the Welsh Government. Data is sourced from public official records.",
  footerSource: "Source code on GitHub",

  // errors
  errorUpstream: "An upstream service returned an error. Please try again later.",
  errorNotFound: "Page not found.",
  errorGoHome: "Go to the homepage",
};

const cy: typeof en = {
  appName: "Olrheinydd Senedd",
  navHome: "Hafan",
  navData: "Argaeledd data",
  tagline: "Olrhain eich cynrychiolwyr yn y Senedd",
  searchPlaceholder: "Rhowch god post neu enw etholaeth (e.e. CF10 1EP)",
  searchButton: "Chwilio",
  searching: "Yn chwilio…",
  recentSearches: "Chwiliadau diweddar",
  clearHistory: "Clirio hanes",
  noResults: "Ni chanfuwyd unrhyw AS",
  tryDifferent: "Rhowch god post neu enw etholaeth gwahanol.",
  yourMSs: "Eich Aelodau o'r Senedd",
  for: "ar gyfer",
  constituency: "Etholaeth",
  region: "Rhanbarth",
  unknown: "Anhysbys",
  loading: "Yn llwytho…",
  error: "Gwall",
  retry: "Ailgychwyn",
  back: "Yn ôl",
  close: "Cau",
  openSource: "Ffynhonnell",
  openRecord: "Cofnod y Trafodion",

  memberNotFound: "Aelod heb ei ddarganfod",
  memberNotFoundDetail: "Efallai nad yw'r aelod hwn wedi'i storio eto. Ceisiwch chwilio yn gyntaf.",
  overview: "Trosolwg",
  speeches: "Areithiau",
  votes: "Pleidleisiau",
  sources: "Ffynonellau",
  noSpeeches: "Dim areithiau wedi'u cofnodi eto.",
  noVotes: "Dim pleidleisiau wedi'u cofnodi eto.",
  refreshData: "Adnewyddu data",
  refreshing: "Yn adnewyddu…",
  refreshSuccess: "Data wedi'i adnewyddu.",
  refreshFailed: "Methiant wrth adnewyddu — ceisiwch eto.",
  party: "Plaid",
  area: "Etholaeth / Rhanbarth",
  topTopics: "Pynciau pennaf",
  topicBreakdown: "Dadansoddiad pynciau",
  totalSpeeches: "Areithiau wedi'u cofnodi",
  totalVotes: "Pleidleisiau wedi'u cofnodi",
  read: "Darllenwch yr araith lawn",
  voteFor: "Dros",
  voteAgainst: "Yn erbyn",
  voteAbstain: "Ymatal",
  voteNoVote: "Heb bleidleisio",
  confidenceHigh: "Paru â hyder uchel",
  confidenceMedium: "Paru â hyder canolig",
  confidenceLow: "Paru â hyder isel",
  page: "Tudalen",
  next: "Nesaf",
  prev: "Blaenorol",
  loadMore: "Llwytho mwy",

  dataAvailabilityTitle: "Argaeledd data",
  dataAvailabilityDesc:
    "Mae'r olrheinydd hwn yn brototeip. Nid yw pob data am aelodau o'r Senedd ar gael. Mae'r dudalen hon yn egluro'r hyn sy'n cael ei olrhain a'r hyn nad yw.",
  statusAvailable: "Ar gael",
  statusPartial: "Rhannol",
  statusNotAvailable: "Ddim ar gael",

  langToggle: "English",
  footerDisclaimer:
    "Mae Olrheinydd y Senedd yn brototeip annibynnol ac nid yw'n gysylltiedig â'r Senedd, Ymchwil y Senedd, na Llywodraeth Cymru. Mae'r data'n dod o gofnodion swyddogol cyhoeddus.",
  footerSource: "Cod ffynhonnell ar GitHub",

  errorUpstream: "Dychwelodd gwasanaeth uwchsgwâr wall. Ceisiwch eto yn nes ymlaen.",
  errorNotFound: "Tudalen heb ei darganfod.",
  errorGoHome: "Ewch i'r hafan",
};

const translations: Record<Locale, typeof en> = { en, cy };

export function t(key: TranslationKey, locale: Locale = "en"): string {
  return translations[locale][key] ?? translations.en[key] ?? key;
}

export function tt(locale: Locale) {
  return (key: TranslationKey) => t(key, locale);
}

export default translations;
