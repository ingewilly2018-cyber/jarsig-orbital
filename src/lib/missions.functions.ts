import { createServerFn } from "@tanstack/react-start";

export type MissionBriefing = {
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  category: "past" | "upcoming" | "update";
  source: string;
};

const feeds = [
  { url: "https://www.nasa.gov/blogs/artemis/feed/", source: "NASA Artemis", category: "update" as const },
];
const scheduleUrl = "https://www.nasa.gov/event-type/launch-schedule/";

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ").trim();
}

function getTag(item: string, tag: string) {
  const value = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(item)?.[1] ?? "";
  return decodeXml(value);
}

async function readFeed(feed: typeof feeds[number]): Promise<MissionBriefing[]> {
  const response = await fetch(feed.url, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "JARSIG-Mission-Briefings/1.0" } });
  if (!response.ok) throw new Error(`${feed.source} feed returned ${response.status}`);
  const xml = await response.text();
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, 25).flatMap((item) => {
    const title = getTag(item, "title");
    const url = getTag(item, "link");
    if (!title || !url || !/^https:\/\/(?:[a-z0-9-]+\.)*nasa\.gov\//i.test(url)) return [];
    const dateText = getTag(item, "pubDate");
    const parsedDate = dateText ? new Date(dateText) : null;
    return [{
      title,
      summary: getTag(item, "description").slice(0, 900),
      url,
      publishedAt: parsedDate && !Number.isNaN(parsedDate.valueOf()) ? parsedDate.toISOString() : null,
      category: feed.category,
      source: feed.source,
    }];
  });
}

function readScheduleDate(text: string): string | null {
  const candidate = /(?:No Earlier Than\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i.exec(text)?.[0]
    ?? /(?:Early|Mid|Late)\s+(?:19|20)\d{2}|(?:19|20)\d{2}/i.exec(text)?.[0];
  if (!candidate) return null;
  const normalized = candidate.replace(/^No Earlier Than\s+/i, "");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

async function readLaunchSchedule(): Promise<MissionBriefing[]> {
  const response = await fetch(scheduleUrl, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "JARSIG-Mission-Briefings/1.0" } });
  if (!response.ok) throw new Error(`NASA Launch Schedule returned ${response.status}`);
  const html = await response.text();
  const cards = html.match(/<article\b[\s\S]*?<\/article>/gi) ?? [];
  const now = new Date();
  return cards.flatMap((card) => {
    const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(card);
    const href = anchor?.[1];
    const anchorTitle = anchor?.[2];
    if (!href || !anchorTitle) return [];
    const url = new URL(href, scheduleUrl).toString();
    if (!/^https:\/\/(?:www\.)?nasa\.gov\//i.test(url) || url === scheduleUrl) return [];
    const title = decodeXml(anchorTitle);
    const text = decodeXml(card);
    if (!title || !/(?:launch|mission|artemis|moon|lunar|crs-|progress|starliner|blue ghost|sunrise)/i.test(`${title} ${text}`)) return [];
    const publishedAt = readScheduleDate(`${title} ${text}`);
    const category = publishedAt && new Date(publishedAt) < now ? "past" : "upcoming";
    return [{ title, summary: text.slice(0, 900), url, publishedAt, category, source: "NASA Launch Schedule" }];
  });
}

export const getMissionBriefings = createServerFn({ method: "GET" }).handler(async (): Promise<{ items: MissionBriefing[]; refreshedAt: string; scheduleUrl: string }> => {
  const { db } = await import("./db.server");
  try {
    const [fresh] = await db<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM mission_updates
      WHERE retrieved_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
    `;
    if ((fresh?.count ?? 0) > 0) {
      const rows = await db<MissionBriefing[]>`
        SELECT title, summary, source_url AS url, published_at::text AS "publishedAt", category, source
        FROM mission_updates ORDER BY published_at DESC NULLS LAST LIMIT 50
      `;
    return { items: rows, refreshedAt: new Date().toISOString(), scheduleUrl };
    }
  } catch {
    // Continue to the official feeds if the cache table has not been initialized yet.
  }

  let items: MissionBriefing[];
  try {
    const results = await Promise.allSettled([readLaunchSchedule(), ...feeds.map(readFeed)]);
    items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    if (!items.length) throw new Error("NASA mission feeds are temporarily unavailable.");
  } catch (error) {
    try {
      const rows = await db<MissionBriefing[]>`
        SELECT title, summary, source_url AS url, published_at::text AS "publishedAt", category, source
        FROM mission_updates ORDER BY published_at DESC NULLS LAST LIMIT 50
      `;
      if (rows.length) return { items: rows, refreshedAt: "Cached NASA feed", scheduleUrl };
    } catch { /* No stored copy is available. */ }
    throw error;
  }

  try {
    await db.begin(async (tx) => {
      for (const item of items) {
        await tx`
          INSERT INTO mission_updates (source, source_url, title, summary, published_at, category, retrieved_at)
          VALUES (${item.source}, ${item.url}, ${item.title}, ${item.summary}, ${item.publishedAt}, ${item.category}, CURRENT_TIMESTAMP)
          ON CONFLICT (source_url) DO UPDATE SET
            source = EXCLUDED.source, title = EXCLUDED.title, summary = EXCLUDED.summary,
            published_at = EXCLUDED.published_at, category = EXCLUDED.category, retrieved_at = CURRENT_TIMESTAMP
        `;
      }
    });
  } catch { /* Keep the official live feed even if persistence is unavailable. */ }
  return { items: items.sort((a, b) => (a.publishedAt ?? "9999").localeCompare(b.publishedAt ?? "9999")), refreshedAt: new Date().toISOString(), scheduleUrl };
});
