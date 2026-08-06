export type Topic =
  | "Health"
  | "Housing"
  | "Transport"
  | "Education"
  | "Economy"
  | "Crime/Justice"
  | "Environment"
  | "Welsh Language"
  | "Local Government";

export const ALL_TOPICS: Topic[] = [
  "Health", "Housing", "Transport", "Education", "Economy",
  "Crime/Justice", "Environment", "Welsh Language", "Local Government",
];

type TopicRule = { topic: Topic; keywords: string[] };

const RULES: TopicRule[] = [
  { topic: "Health", keywords: ["health", "nhs", "hospital", "gp", "doctor", "nurse", "patient", "public health", "iechyd", "gofal iechyd", "ysbyty", "meddyg", "nyrs"] },
  { topic: "Housing", keywords: ["housing", "home", "homes", "rent", "rental", "tenant", "landlord", "homeless", "planning", "tai", "rhent", "digartref", "cynllunio"] },
  { topic: "Transport", keywords: ["transport", "bus", "rail", "train", "tram", "road", "roads", "traffic", "cycling", "metro", "trafnidiaeth", "bws", "rheil", "tren", "ffordd", "traffig", "beicio"] },
  { topic: "Education", keywords: ["education", "school", "schools", "college", "university", "teacher", "teachers", "pupil", "students", "curriculum", "addysg", "ysgol", "athro", "athrawon", "disgybl", "myfyrwyr", "cwricwlwm"] },
  { topic: "Economy", keywords: ["economy", "economic", "jobs", "employment", "business", "industry", "trade", "inflation", "energy", "cost of living", "economi", "swyddi", "cyflogaeth", "busnes", "diwydiant", "masnach", "ynni", "costau byw"] },
  { topic: "Crime/Justice", keywords: ["crime", "police", "justice", "courts", "prison", "sentenc", "violence", "abuse", "trosedd", "heddlu", "cyfiawnder", "llys", "carchar", "trais", "cam-drin"] },
  { topic: "Environment", keywords: ["environment", "climate", "net zero", "carbon", "biodiversity", "flood", "pollution", "renewable", "green", "amgylchedd", "hinsawdd", "sero net", "bioamrywiaeth", "llifogydd", "llygredd", "adnewyddadwy", "gwyrdd"] },
  { topic: "Welsh Language", keywords: ["welsh language", "cymraeg", "bilingual", "welsh-medium", "iaith", "dwyieith", "ysgolion cyfrwng cymraeg"] },
  { topic: "Local Government", keywords: ["local government", "council", "councils", "local authority", "planning authority", "municipal", "llywodraeth leol", "cyngor", "awdurdod lleol"] },
];

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/["""']/g, "").trim();
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function classifyTopicsFromText(text: string): Topic[] {
  const normalized = normalize(text);
  if (!normalized) return [];
  const hits: Topic[] = [];
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(normalize(kw))) { hits.push(rule.topic); break; }
    }
  }
  return dedupe(hits);
}

export function primaryTopicFromText(text: string): Topic | null {
  const normalized = normalize(text);
  if (!normalized) return null;
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(normalize(kw))) return rule.topic;
    }
  }
  return null;
}

export function topTopicsFromItems(
  items: Array<{ title?: string; snippetEn?: string; snippetCy?: string; contextEn?: string; contextCy?: string }>,
  topN = 3
): Topic[] {
  const counts = new Map<Topic, number>();
  for (const it of items) {
    const text = [it.title, it.contextEn, it.contextCy, it.snippetEn, it.snippetCy].filter(Boolean).join(" ");
    const topic = primaryTopicFromText(text);
    if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([t]) => t);
}

export function topicBreakdownFromItems(
  items: Array<{ title?: string; snippetEn?: string; snippetCy?: string; contextEn?: string; contextCy?: string }>
) {
  const counts = new Map<Topic, number>();
  for (const it of items) {
    const text = [it.title, it.contextEn, it.contextCy, it.snippetEn, it.snippetCy].filter(Boolean).join(" ");
    const topic = primaryTopicFromText(text);
    if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([topic, count]) => ({ topic, count }));
}
