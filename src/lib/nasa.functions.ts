import { createServerFn } from "@tanstack/react-start";

// NASA moon data. NASA_API_KEY is optional; falls back to NASA's rate-limited DEMO_KEY.
const apiKey = () => process.env["NASA_API_KEY"] || "DEMO_KEY";

export type MoonImage = { id: string; title: string; description: string; date: string; thumb: string };

/** Search NASA's Image & Video Library for Moon imagery (no key required). */
export const searchMoonImages = createServerFn({ method: "GET" })
  .inputValidator((input: { query?: string; page?: number }) => ({
    query: (input.query ?? "moon surface").slice(0, 100),
    page: Math.max(1, Math.min(50, Math.floor(input.page ?? 1))),
  }))
  .handler(async ({ data }): Promise<MoonImage[]> => {
    const url = `https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(data.query)}&page=${data.page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NASA images request failed (${res.status})`);
    const json = (await res.json()) as { collection: { items: Array<{ data: Array<Record<string, string>>; links?: Array<{ href: string }> }> } };
    return json.collection.items.slice(0, 24).map((it) => {
      const d = it.data[0] ?? {};
      return { id: d["nasa_id"] ?? "", title: d["title"] ?? "", description: d["description"] ?? "", date: d["date_created"] ?? "", thumb: it.links?.[0]?.href ?? "" };
    });
  });

/** NASA Astronomy Picture of the Day (uses NASA_API_KEY). */
export const getApod = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey()}`);
  if (!res.ok) throw new Error(`NASA APOD request failed (${res.status})`);
  const j = (await res.json()) as { title: string; explanation: string; url: string; media_type: string; date: string };
  return { title: j.title, explanation: j.explanation, url: j.url, mediaType: j.media_type, date: j.date };
});
