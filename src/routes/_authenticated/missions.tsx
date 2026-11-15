import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getMissionBriefings, type MissionBriefing } from "@/lib/missions.functions";
import { searchMoonImages, type MoonImage } from "@/lib/nasa.functions";

export const Route = createFileRoute("/_authenticated/missions")({
  head: () => ({ meta: [{ title: "Mission briefings — JARSIG" }, { name: "description", content: "NASA mission updates and launch schedule." }] }),
  component: MissionBriefingsPage,
});

type BriefingResponse = { items: MissionBriefing[]; refreshedAt: string; scheduleUrl: string };

function MissionBriefingsPage() {
  const [briefings, setBriefings] = useState<BriefingResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [imageQuery, setImageQuery] = useState("Moon south pole");
  const [moonImages, setMoonImages] = useState<MoonImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState("");
  const refresh = useCallback(async () => {
    try { setBriefings(await getMissionBriefings()); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "NASA mission updates are temporarily unavailable."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const searchImages = useCallback(async (query: string) => {
    setImagesLoading(true); setImagesError("");
    try { setMoonImages(await searchMoonImages({ data: { query } })); }
    catch (err) { setImagesError(err instanceof Error ? err.message : "NASA image search is temporarily unavailable."); }
    finally { setImagesLoading(false); }
  }, []);

  useEffect(() => { void searchImages("Moon south pole"); }, [searchImages]);

  const upcoming = briefings?.items.filter((item) => item.category === "upcoming") ?? [];
  const updates = briefings?.items.filter((item) => item.category !== "upcoming") ?? [];
  const card = "border-t border-border py-5";
  return (
    <main className="min-h-screen bg-background px-6 py-10 font-sans text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">NASA official feeds</p><h1 className="text-poster mt-3 text-5xl">Mission briefings</h1><p className="mt-4 max-w-3xl text-sm text-muted-foreground">A continuously refreshed stream of NASA Artemis updates and the agency’s published launch schedule. Planned dates can change; the official schedule is the authority.</p></div>
          <button onClick={() => { setLoading(true); void refresh(); }} disabled={loading} className="border border-foreground px-5 py-3 text-xs uppercase tracking-widest hover:bg-foreground hover:text-background disabled:opacity-50">{loading ? "Refreshing…" : "Refresh now"}</button>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{briefings ? `Last updated ${briefings.refreshedAt === "Cached NASA feed" ? briefings.refreshedAt : new Date(briefings.refreshedAt).toLocaleString()}` : "Updates checked on page load and every 15 minutes"}</span>
          <a href={briefings?.scheduleUrl ?? "https://www.nasa.gov/event-type/launch-schedule/"} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">NASA launch schedule</a>
        </div>
        {error && <p className="mt-5 border border-border px-4 py-3 text-sm" role="status">{error}</p>}
        {loading && !briefings && <p className="mt-8 text-sm text-muted-foreground">Loading NASA mission information…</p>}
        {briefings && <div className="mt-10 grid gap-12 lg:grid-cols-2">
          <section>
            <div className="flex items-baseline justify-between border-b border-border pb-3"><h2 className="font-display text-2xl">Upcoming launches</h2><span className="text-xs text-muted-foreground">NASA official schedule</span></div>
            {upcoming.length ? upcoming.map((item) => <article key={item.url} className={card}><p className="text-xs uppercase tracking-widest text-muted-foreground">{item.source} · planned schedule</p><h3 className="mt-2 font-display text-xl">{item.title}</h3>{item.summary && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>}<a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs underline underline-offset-4">NASA event details</a></article>) : <p className="py-5 text-sm text-muted-foreground">No schedule items were returned. Check NASA’s official launch schedule for the latest entries.</p>}
          </section>
          <section>
            <div className="flex items-baseline justify-between border-b border-border pb-3"><h2 className="font-display text-2xl">Mission news & history</h2><span className="text-xs text-muted-foreground">NASA Artemis blog</span></div>
            {updates.length ? updates.map((item) => <article key={item.url} className={card}><p className="text-xs uppercase tracking-widest text-muted-foreground">{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "NASA update"} · {item.source}</p><h3 className="mt-2 font-display text-xl">{item.title}</h3>{item.summary && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>}<a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs underline underline-offset-4">Read NASA source</a></article>) : <p className="py-5 text-sm text-muted-foreground">Mission reporting is temporarily unavailable.</p>}
            <a href="https://www.nasa.gov/missions/" target="_blank" rel="noreferrer" className="mt-5 inline-block border border-border px-4 py-3 text-xs uppercase tracking-widest hover:border-foreground">Browse NASA mission archive</a>
          </section>
        </div>}
        <section className="mt-14 border-t border-border pt-8" aria-labelledby="nasa-moon-gallery-title">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">NASA Image and Video Library API</p>
          <h2 id="nasa-moon-gallery-title" className="text-poster mt-3 text-3xl">Explore NASA Moon imagery</h2>
          <form onSubmit={(event) => { event.preventDefault(); void searchImages(imageQuery); }} className="mt-5 flex max-w-xl gap-3">
            <input value={imageQuery} onChange={(event) => setImageQuery(event.target.value)} aria-label="Search NASA Moon images" className="min-w-0 flex-1 border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-glow" placeholder="Try Artemis, lunar south pole…" />
            <button disabled={imagesLoading || !imageQuery.trim()} className="border border-foreground px-4 py-2 text-xs uppercase tracking-widest hover:bg-foreground hover:text-background disabled:opacity-50">{imagesLoading ? "Searching…" : "Search"}</button>
          </form>
          {imagesError && <p role="status" className="mt-4 text-sm text-muted-foreground">{imagesError}</p>}
          {imagesLoading && moonImages.length === 0 && <p className="mt-5 text-sm text-muted-foreground">Loading live results from NASA…</p>}
          {!imagesLoading && !imagesError && moonImages.length === 0 && <p className="mt-5 text-sm text-muted-foreground">No images matched that search. Try “Moon”, “Apollo”, or “Artemis”.</p>}
          {moonImages.length > 0 && <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{moonImages.map((image) => <article key={image.id} className="border border-border"><img src={image.thumb} alt={image.title} loading="lazy" className="aspect-[4/3] w-full bg-black object-cover" /><div className="p-3"><h3 className="line-clamp-2 font-display text-base">{image.title}</h3><p className="mt-1 text-xs text-muted-foreground">{image.date ? new Date(image.date).toLocaleDateString() : "NASA archive"}</p><p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{image.description}</p><a href={`https://images.nasa.gov/details/${encodeURIComponent(image.id)}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs underline underline-offset-4">View NASA archive record</a></div></article>)}</div>}
        </section>
        <p className="mt-12 border-t border-border pt-5 text-xs text-muted-foreground">This page refreshes NASA’s public launch schedule and Artemis updates every 15 minutes while it is open. It does not provide spacecraft telemetry or predict launch dates.</p>
      </div>
    </main>
  );
}
