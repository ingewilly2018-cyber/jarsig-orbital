import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { analyzeLunarSky, listMySavedAnalyses, saveLunarAnalysis, type SavedAnalysis, type SkyAnalysis, type SkySample } from "@/lib/science.functions";
import { listPsrZones, type PsrZone } from "@/lib/database.functions";
import { LUNAR_REFERENCE_SITES, SITE_COORDINATES_SOURCE_URL } from "@/lib/lunar-sites";

export const Route = createFileRoute("/_authenticated/science")({
  head: () => ({ meta: [{ title: "Sun & Earth — JARSIG" }, { name: "description", content: "Topocentric lunar sky analysis from JPL Horizons." }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    latitude: Number(search["latitude"] ?? -89.5),
    longitude: Number(search["longitude"] ?? 0),
  }),
  component: SciencePage,
});

const field = "w-full border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-glow";
const button = "border border-foreground px-5 py-3 text-xs uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:opacity-50";
const formatDate = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toLocaleString();

function ElevationChart({ title, samples, color }: { title: string; samples: SkySample[]; color: string }) {
  const points = samples.map((sample, index) => `${samples.length < 2 ? 360 : (index / (samples.length - 1)) * 700 + 10},${10 + ((90 - Math.max(-90, Math.min(90, sample.elevation))) / 180) * 150}`).join(" ");
  return (
    <div className="border-y border-border py-5">
      <div className="flex items-baseline justify-between"><h3 className="font-display text-lg">{title} elevation</h3><span className="text-xs text-muted-foreground">Degrees above lunar horizon</span></div>
      <svg viewBox="0 0 720 180" role="img" aria-label={`${title} elevation throughout the selected period`} className="mt-3 w-full overflow-visible">
        <line x1="10" x2="710" y1="85" y2="85" stroke="currentColor" strokeOpacity=".25" strokeDasharray="4 5" />
        <text x="12" y="80" fill="currentColor" fontSize="10" opacity=".6">0° horizon</text>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{samples[0] ? new Date(samples[0].time).toLocaleString() : ""}</span><span>{samples.at(-1) ? new Date(samples.at(-1)!.time).toLocaleString() : ""}</span></div>
    </div>
  );
}

function visibilityWindows(samples: SkySample[]) {
  const windows: Array<{ start: string; end: string }> = [];
  let start: string | null = null;
  for (const sample of samples) {
    if (sample.elevation > 0 && start === null) start = sample.time;
    if (sample.elevation <= 0 && start !== null) {
      windows.push({ start, end: samples[Math.max(0, samples.indexOf(sample) - 1)]!.time });
      start = null;
    }
  }
  if (start !== null && samples.length) windows.push({ start, end: samples.at(-1)!.time });
  return windows;
}

function SciencePage() {
  const search = Route.useSearch();
  const now = new Date();
  const [latitude, setLatitude] = useState(String(search.latitude));
  const [longitude, setLongitude] = useState(String(search.longitude));
  const [altitudeKm, setAltitudeKm] = useState("0");
  const [date, setDate] = useState(now.toISOString().slice(0, 10));
  const [time, setTime] = useState(`${now.toISOString().slice(11, 13)}:00`);
  const [duration, setDuration] = useState("48");
  const [analysis, setAnalysis] = useState<SkyAnalysis | null>(null);
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [zones, setZones] = useState<PsrZone[]>([]);
  const [comparison, setComparison] = useState<Array<{ label: string; result: SkyAnalysis }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    listMySavedAnalyses().then(setSaved).catch(() => setSaved([]));
    listPsrZones().then(setZones).catch(() => setZones([]));
  }, []);
  useEffect(() => { setLatitude(String(search.latitude)); setLongitude(String(search.longitude)); }, [search.latitude, search.longitude]);

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(""); setAnalysis(null);
    try {
      const result = await analyzeLunarSky({ data: {
        latitude: Number(latitude), longitude: Number(longitude), altitudeKm: Number(altitudeKm),
        startTime: new Date(`${date}T${time}:00Z`).toISOString(), durationHours: Number(duration),
      } });
      setAnalysis(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Horizons analysis could not be completed.");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!analysis) return;
    try {
      await saveLunarAnalysis({ data: {
        siteName: `Custom lunar site (${analysis.site.latitude.toFixed(2)}°, ${analysis.site.longitude.toFixed(2)}°)`,
        latitude: analysis.site.latitude, longitude: analysis.site.longitude, altitudeKm: analysis.site.altitudeKm,
        startTime: analysis.startTime, endTime: analysis.endTime, results: analysis,
      } });
      setMessage("Analysis saved to your account.");
      setSaved(await listMySavedAnalyses());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this analysis."); }
  }

  const illuminatedSamples = analysis?.sun.filter((sample) => sample.elevation > 0).length ?? 0;
  const earthVisibleSamples = analysis?.earth.filter((sample) => sample.elevation > 0).length ?? 0;
  const sunWindows = analysis ? visibilityWindows(analysis.sun) : [];
  const earthWindows = analysis ? visibilityWindows(analysis.earth) : [];
  return (
    <main className="min-h-screen bg-background px-6 py-10 font-sans text-foreground">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">JPL Horizons · lunar topocentric observer</p>
        <h1 className="text-poster mt-3 text-5xl md:text-6xl">Sun / Earth visibility</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">Set an east longitude and latitude on the Moon. Horizons calculates apparent azimuth and elevation from this surface point. Horizon visibility here is geometric and does not include local terrain masking.</p>

        <label className="mt-8 block max-w-md text-xs text-muted-foreground">Load a published south-pole reference point<select className={`${field} mt-2`} defaultValue="" onChange={(event) => { const point = LUNAR_REFERENCE_SITES.find((site) => site.id === event.target.value); if (point) { setLatitude(String(point.latitude)); setLongitude(String(point.longitude)); } }}><option value="">Custom coordinates</option>{LUNAR_REFERENCE_SITES.map((point) => <option key={point.id} value={point.id}>{point.name} · {point.id} ({point.latitude.toFixed(2)}°, {point.longitude.toFixed(2)}°)</option>)}</select><span className="mt-2 block">Representative points from a published Artemis candidate-site study · <a href={SITE_COORDINATES_SOURCE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">source</a></span></label>
        {zones.length > 0 && <label className="mt-8 block max-w-md text-xs text-muted-foreground">Load a recorded PSR site<select className={`${field} mt-2`} defaultValue="" onChange={(event) => { const selected = zones.find((zone) => zone.id === Number(event.target.value)); if (selected) { setLatitude(String(selected.latitude)); setLongitude(String(selected.longitude)); } }}><option value="">Custom coordinates</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.crater_name} · {zone.latitude.toFixed(2)}°, {zone.longitude.toFixed(2)}°</option>)}</select></label>}
        <form onSubmit={analyze} className="mt-8 grid gap-4 border-y border-border py-6 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-xs text-muted-foreground">Latitude °<input required type="number" step="any" min="-90" max="90" className={`${field} mt-2`} value={latitude} onChange={(e) => setLatitude(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">East longitude °<input required type="number" step="any" min="-180" max="180" className={`${field} mt-2`} value={longitude} onChange={(e) => setLongitude(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">Altitude km<input required type="number" step="any" min="-10" max="100" className={`${field} mt-2`} value={altitudeKm} onChange={(e) => setAltitudeKm(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">UTC date<input required type="date" className={`${field} mt-2`} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">UTC time<input required type="time" className={`${field} mt-2`} value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">Period in hours<input required type="number" min="1" max="168" className={`${field} mt-2`} value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
          <div className="sm:col-span-2 lg:col-span-6"><button className={button} disabled={busy}>{busy ? "Querying Horizons…" : "Analyze selected period"}</button></div>
        </form>

        {message && <p className="mt-5 border border-border px-4 py-3 text-sm" role="status">{message}</p>}
        {analysis && <>
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="border border-border p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Sun above horizon</p><p className="mt-2 text-3xl">{illuminatedSamples} <span className="text-base text-muted-foreground">of {analysis.sun.length} samples</span></p></div>
            <div className="border border-border p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Earth above horizon</p><p className="mt-2 text-3xl">{earthVisibleSamples} <span className="text-base text-muted-foreground">of {analysis.earth.length} samples</span></p></div>
            <div className="border border-border p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Surface site</p><p className="mt-2 text-lg">{analysis.site.latitude.toFixed(3)}°, {analysis.site.longitude.toFixed(3)}°</p></div>
          </section>
          <section className="mt-5 grid gap-4 sm:grid-cols-2">
            {[ ["Sun", analysis.sun.at(0)], ["Earth", analysis.earth.at(0)] ].map(([body, sample]) => <div key={body as string} className="border border-border px-5 py-4"><p className="text-xs uppercase tracking-widest text-muted-foreground">{body as string} at period start</p><p className="mt-2 text-sm">Azimuth <strong>{(sample as SkySample | undefined)?.azimuth.toFixed(2) ?? "—"}°</strong><span className="mx-3 text-muted-foreground">·</span>Elevation <strong>{(sample as SkySample | undefined)?.elevation.toFixed(2) ?? "—"}°</strong></p></div>)}
          </section>
          <section className="mt-8 space-y-2 border border-border px-5">
            <ElevationChart title="Sun" samples={analysis.sun} color="var(--glow)" />
            <ElevationChart title="Earth" samples={analysis.earth} color="oklch(0.72 0.16 265)" />
          </section>
          <section className="mt-8 border-t border-border pt-6"><h2 className="font-display text-xl">Sampled sunlight windows</h2><p className="mt-2 text-xs text-muted-foreground">Intervals are estimated from hourly JPL Horizons samples; they do not include terrain shadows.</p>{sunWindows.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{sunWindows.map((window, index) => <li key={window.start} className="border border-border px-4 py-3 text-sm"><span className="mr-2 text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>{new Date(window.start).toLocaleString()} — {new Date(window.end).toLocaleString()}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">The Sun remains below the geometric horizon during this sampled period.</p>}</section>
          <section className="mt-8 border-t border-border pt-6"><h2 className="font-display text-xl">Direct Earth visibility windows</h2><p className="mt-2 text-xs text-muted-foreground">Geometric horizon windows from the hourly ephemeris; local terrain may shorten or block them.</p>{earthWindows.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{earthWindows.map((window, index) => <li key={window.start} className="border border-border px-4 py-3 text-sm"><span className="mr-2 text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>{new Date(window.start).toLocaleString()} — {new Date(window.end).toLocaleString()}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Earth remains below the geometric horizon during this sampled period.</p>}</section>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>Source: {analysis.source} · calculated {new Date(analysis.fetchedAt).toLocaleString()}</span><button type="button" className={button} onClick={save}>Save analysis</button></div>
          <button type="button" className="mt-4 border border-border px-4 py-3 text-xs uppercase tracking-widest hover:border-foreground" onClick={() => setComparison((items) => [...items, { label: `${analysis.site.latitude.toFixed(2)}°, ${analysis.site.longitude.toFixed(2)}° · ${new Date(analysis.startTime).toLocaleDateString()}`, result: analysis }])}>Add this site and period to comparison</button>
        </>}

        {comparison.length > 0 && <section className="mt-10"><div className="flex justify-between"><h2 className="font-display text-2xl">Site and date comparison</h2><button className="text-xs underline underline-offset-4" onClick={() => setComparison([])}>Clear</button></div><div className="mt-4 overflow-x-auto border-y border-border"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="text-xs uppercase tracking-widest text-muted-foreground"><tr><th className="py-3 pr-4 font-normal">Site / period</th><th className="py-3 pr-4 font-normal">Sunlit samples</th><th className="py-3 pr-4 font-normal">Earth visible</th><th className="py-3 font-normal">Source</th></tr></thead><tbody className="divide-y divide-border">{comparison.map((entry, index) => <tr key={`${entry.result.startTime}-${index}`}><td className="py-3 pr-4">{entry.label}</td><td className="py-3 pr-4">{entry.result.sun.filter((sample) => sample.elevation > 0).length} / {entry.result.sun.length}</td><td className="py-3 pr-4">{entry.result.earth.filter((sample) => sample.elevation > 0).length} / {entry.result.earth.length}</td><td className="py-3">JPL Horizons</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">Hourly samples; relief masking and panel characteristics are not included.</p></section>}

        <section className="mt-14 border-t border-border pt-8">
          <h2 className="font-display text-2xl">Your saved analyses</h2>
          {saved.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No saved analyses yet.</p> : <ul className="mt-4 divide-y divide-border border-y border-border">{saved.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-3 py-4 text-sm"><span>{item.site_name} · {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°</span><span className="text-muted-foreground">{formatDate(item.start_time)} — {formatDate(item.end_time)}</span></li>)}</ul>}
        </section>
        <p className="mt-8 text-xs text-muted-foreground">Sunlight duration is estimated from hourly samples, not a high-resolution terrain or electrical power model.</p>
      </div>
    </main>
  );
}
