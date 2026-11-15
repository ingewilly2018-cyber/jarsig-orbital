import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getMissionBriefings, type MissionBriefing } from "@/lib/missions.functions";

export const Route = createFileRoute("/_authenticated/missions")({
  head: () => ({ meta: [{ title: "Mission briefings — JARSIG" }, { name: "description", content: "NASA mission updates and launch schedule." }] }),
  component: MissionBriefingsPage,
});

type BriefingResponse = { items: MissionBriefing[]; refreshedAt: string; scheduleUrl: string };

function MissionBriefingsPage() {
  const [briefings, setBriefings] = useState<BriefingResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
        <p className="mt-12 border-t border-border pt-5 text-xs text-muted-foreground">This page refreshes NASA’s public launch schedule and Artemis updates every 15 minutes while it is open. It does not provide spacecraft telemetry or predict launch dates.</p>
      </div>
    </main>
  );
}
