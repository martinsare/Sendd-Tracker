import * as cheerio from "cheerio";
import { cachedFetchText } from "../httpCache";
import { env } from "../env";

const SOURCE = "senedd-record-xml-export";
const EXPORT_URL = "https://record.senedd.wales/XMLExport";

export type ExportItem = {
  title: string;
  dateText?: string;
  transcriptBilingualUrl?: string;
  transcriptWelshUrl?: string;
  transcriptEnglishUrl?: string;
  votesBilingualUrl?: string;
};

export async function listRecentPlenaryExports(limit = 10) {
  const res = await cachedFetchText({ url: EXPORT_URL, source: SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (res.status < 200 || res.status >= 300)
    throw new Error(`XMLExport fetch failed (${res.status})`);

  const $ = cheerio.load(res.body);
  const rows = $("table tr").toArray();
  const items: ExportItem[] = [];

  for (const row of rows) {
    const tds = $(row).find("td");
    if (tds.length < 2) continue;

    const title = $(tds[0]).text().trim();
    const dateText = $(tds[1]).text().trim();
    if (!/^\s*Plenary\b/i.test(dateText)) continue;

    const item: ExportItem = { title, dateText };
    const links = $(row).find("a").toArray();

    for (const a of links) {
      const hrefRaw = $(a).attr("href");
      if (!hrefRaw) continue;
      const href = new URL(hrefRaw, EXPORT_URL).toString();
      let xmlDownloadType: string | null = null;
      try {
        xmlDownloadType = new URL(href).searchParams.get("xmlDownloadType");
      } catch {
        xmlDownloadType = null;
      }
      switch (xmlDownloadType) {
        case "BilingualTranscript": item.transcriptBilingualUrl = href; break;
        case "WelshTranscript": item.transcriptWelshUrl = href; break;
        case "EnglishTranscript": item.transcriptEnglishUrl = href; break;
        case "Votes": item.votesBilingualUrl = href; break;
      }
    }

    if (item.transcriptBilingualUrl || item.votesBilingualUrl) items.push(item);
    if (items.length >= limit) break;
  }

  return { items, fromCache: res.fromCache, sourceUrl: EXPORT_URL };
}
