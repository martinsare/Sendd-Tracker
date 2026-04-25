export const enStrings: Record<string, string> = {
  app_title: "Senedd Tracker",
  app_subtitle: "Recorded participation dashboard (MVP)",
  app_subtitle_short: "Participation tracker",
  nav_home: "Home",
  nav_data: "Data availability",
  hero_title_a: "Track your",
  hero_title_b: "Member of the Senedd",
  hero_desc:
    "Search by postcode or constituency to find your Senedd Member and see their recorded participation in plenary sessions. All data is sourced directly from official Senedd records.",
  search_title: "Find your Member of the Senedd",
  search_help: "Search by postcode or constituency/region name.",
  search_placeholder: "e.g. CF10 1EP or Cardiff Central",
  search_button: "Search",
  loading_short: "Searching…",
  results_title: "Matches",
  results_empty: "No matches found. Try a different spelling or use a postcode.",
  view_dashboard: "View dashboard",
  feature1_title: "Official Records",
  feature1_desc:
    "All participation data is extracted directly from official Senedd Record of Proceedings exports — no assumptions, no guesswork.",
  feature2_title: "Transparent Data",
  feature2_desc:
    "Every data point is clearly labelled as verified, partial, or unavailable. We never imply more than we can confirm.",
  feature3_title: "Bilingual",
  feature3_desc:
    "The tracker fully supports both English and Welsh, matching the bilingual nature of the Senedd's official records.",
  member_card_title: "Member dashboard",
  member_party: "Party",
  member_area: "Constituency / Region",
  member_profile: "Official profile",
  member_summary: "Member overview",
  member_overview_generated:
    "This dashboard indexes recent plenary transcripts. {count} verified spoken contributions are currently indexed for this Member.",
  member_missing:
    "Member details are not available. Please go back and search again.",
  participation_title: "Recorded participation (not attendance)",
  participation_help:
    "This section shows what is realistically available in the MVP and always links to official sources.",
  record_exports_title: "Recent plenary transcript exports",
  record_exports_empty: "No exports available right now.",
  data_title: "Data availability & transparency",
  data_help:
    "Each data metric is labelled as available, partially available, or not available. Missing data is shown explicitly — never hidden.",
  data_metrics_heading: "Data metrics",
  status_available: "Available",
  status_partial: "Partial",
  status_not_available: "Not available",
  footer_disclaimer:
    "MVP: shows recorded participation only. All data links to official Senedd sources.",
  no_verified_participation:
    "No verified recorded participation found in the indexed sources yet.",
  no_verified_votes:
    "No verified votes/divisions found in the indexed sources yet.",
  exports_desc:
    "These are the official plenary transcripts Senedd Tracker indexes to extract per‑Member spoken contributions. Open the official record to read the full session in context.",
  exports_tip:
    "Tip: Senedd Tracker extracts and summarises contributions, but the official record is the authoritative source for full context and verification.",
  source_label: "Source",
  cache_cached: "cached",
  cache_live: "live",
  confidence_high: "High confidence",
  confidence_medium: "Medium confidence",
  confidence_low: "Low confidence",
  real_spoken_title: "Spoken contributions (plenary)",
  real_spoken_desc:
    "Extracted from official Record of Proceedings exports. Each item includes a confidence label and source link.",
  real_votes_title: "Votes/divisions (plenary)",
  real_votes_desc:
    "Extracted from official vote exports where available. Each item links to the official record for verification.",
  data_partial_warning: "Data is partial in the MVP (recent plenary exports only).",
  activity_indexed_note:
    "Activity metrics are based on currently indexed plenary sessions only.",
  data_note_limited_recent_plenary_exports:
    "Limited to recent plenary exports (MVP).",
  data_note_name_matching_uncertain:
    "Some matches are uncertain due to speaker-name formatting in the official export.",
  data_note_no_recent_contributions_found:
    "No matching contributions found in the recent exports indexed.",
  data_note_upstream_or_parse_issue:
    "Unable to fetch or parse some official exports right now.",
  last_updated: "Last updated",
  refresh_data: "Refresh data",
  refreshing: "Refreshing…",
  activity_summary: "Activity summary",
  total_contributions: "Total spoken contributions",
  last_30_days: "Last 30 days",
  activity_level: "Activity level",
  top_topics: "Top topics",
  topic_breakdown: "Topic breakdown",
  insight_sentence:
    "This Member has shown {level} activity in recent plenary sessions, focusing on {topics}.",
  topic_note:
    "Topics are derived using keyword-based classification of contribution text.",
  timestamp_note:
    "Session timestamp is used where individual speaking timestamps are not available.",
  view_record_page: "View official record",
  read_full: "Read full text",
  close: "Close",
  official_source: "Official source",
  full_text_unavailable: "Full text is not available yet. Try refreshing data.",
  full_text_fallback_other_language:
    "This item is not available in the selected language. Showing the other official language instead.",
  language_label: "Language",
  loading: "Loading…",
  why_matters_title: "Why this matters",
  why_matters_body:
    "For a Computational & Data Journalism dissertation, the key principle is epistemic transparency: clearly distinguishing what is measured, what is inferred, and what is unknown. This page prevents the MVP from implying \"attendance\" or completeness when only recorded participation is available.",
  lang_switch: "Language",
  lang_en: "English",
  lang_cy: "Cymraeg",
  recent_searches: "Recent searches",
  clear_history: "Clear",
  copy_link: "Share",
  copied: "Link copied!",
  refresh_success: "Data refreshed",
  scroll_to_top: "Back to top",
  page_not_found: "Page not found",
  not_found_desc: "The page you're looking for doesn't exist.",
  go_home: "Go home",
  install_app: "Install app",
};

export type Lang = "en" | "cy";

// Bilingual-ready UI labels (manual, no auto-translation). Missing keys fall back to English.
export const cyStrings: Partial<Record<string, string>> = {
  nav_home: "Hafan",
  nav_data: "Argaeledd data",
  search_title: "Dod o hyd i’ch Aelod o’r Senedd",
  search_help: "Chwiliwch drwy god post neu enw etholaeth/rhanbarth.",
  search_placeholder: "e.e. CF10 1EP neu Canol Caerdydd",
  search_button: "Chwilio",
  results_title: "Canlyniadau",
  results_empty: "Dim canlyniadau. Rhowch sillafu arall neu defnyddiwch god post.",
  view_dashboard: "Gweld dangosfwrdd",
  member_profile: "Proffil swyddogol",
  member_summary: "Trosolwg aelod",
  member_overview_generated:
    "Mae’r dangosfwrdd hwn yn mynegeio trawsgrifiadau cyfarfod llawn diweddar. Mae {count} o gyfraniadau llafar wedi eu gwirio wedi eu mynegeio ar gyfer yr Aelod hwn.",
  member_missing: "Nid yw manylion yr aelod ar gael. Ewch yn ôl a chwiliwch eto.",
  activity_summary: "Crynodeb gweithgarwch",
  total_contributions: "Cyfanswm y cyfraniadau llafar",
  last_30_days: "30 diwrnod diwethaf",
  activity_level: "Lefel gweithgarwch",
  topic_breakdown: "Dadansoddiad pynciau",
  topic_note: "Mae pynciau’n cael eu deillio drwy ddosbarthiad seiliedig ar eiriau allweddol o destun y cyfraniad.",
  activity_indexed_note: "Mae metrigau gweithgarwch yn seiliedig ar sesiynau cyfarfod llawn sydd wedi eu mynegeio yn unig.",
  timestamp_note: "Defnyddir stamp amser y sesiwn lle nad yw stampiau amser siarad unigol ar gael.",
  view_record_page: "Gweld y cofnod swyddogol",
  read_full: "Darllen y testun llawn",
  close: "Cau",
  official_source: "Ffynhonnell swyddogol",
  full_text_unavailable: "Nid yw’r testun llawn ar gael eto. Ceisiwch adnewyddu data.",
  full_text_fallback_other_language:
    "Nid yw’r eitem hon ar gael yn yr iaith a ddewiswyd. Yn dangos yr iaith swyddogol arall yn lle hynny.",
  language_label: "Iaith",
  last_updated: "Diweddarwyd ddiwethaf",
  refresh_data: "Adnewyddu data",
  refreshing: "Yn adnewyddu…",
  exports_tip: 'Awgrym: defnyddiwch "Gweld y cofnod swyddogol" i ddarllen y trawsgrifiad llawn ar wefan y Senedd.',
  source_label: "Ffynhonnell",
  cache_cached: "o’r storfa",
  cache_live: "yn fyw",
  confidence_high: "Hyder uchel",
  confidence_medium: "Hyder canolig",
  confidence_low: "Hyder isel",
  status_partial: "Yn rhannol ar gael",
  status_available: "Ar gael",
  status_not_available: "Ddim ar gael / heb ei ddilysu",
  loading: "Yn llwytho…",
  lang_en: "English",
  lang_cy: "Cymraeg",
  copy_link: "Rhannu",
  copied: "Dolen wedi ei chopïo!",
  refresh_success: "Data wedi ei adnewyddu",
  no_verified_participation:
    "Heb ganfod cyfranogiad wedi ei gofnodi wedi ei ddilysu yn y ffynonellau wedi eu mynegeio eto.",
  no_verified_votes:
    "Heb ganfod pleidleisiau/rhaniadau wedi eu dilysu yn y ffynonellau wedi eu mynegeio eto.",
  real_votes_title: "Pleidleisiau/rhaniadau (cyfarfod llawn)",
  real_votes_desc:
    "Wedi ei dynnu o allforion pleidleisio swyddogol lle bo ar gael. Mae pob eitem yn cysylltu â’r cofnod swyddogol i’w wirio.",
};
