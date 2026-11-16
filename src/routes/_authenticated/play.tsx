import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { NasaWmtsMap } from "@/components/NasaWmtsMap";
import { NasaMoonGlobe } from "@/components/NasaMoonGlobe";
import { getCountryFootprint, getCountryNames, type CountryFootprint } from "@/lib/country-footprints";
import { listPsrZones, type MissionLog, type PsrZone } from "@/lib/database.functions";
import { LUNAR_REFERENCE_SITES, NASA_ARTEMIS_REGIONS_URL, SITE_COORDINATES_SOURCE_URL } from "@/lib/lunar-sites";

export const Route = createFileRoute("/_authenticated/play")({
  head: () => ({
    meta: [
      { title: "Moon Landing — JARSIG" },
      { name: "description", content: "Pick a region on the Moon and land your spacecraft safely." },
      { property: "og:title", content: "Moon Landing — JARSIG" },
      { property: "og:description", content: "Pick a region on the Moon and land your spacecraft safely." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Play,
});

type Site = { id: string; name: string; desc: string; rough: number; pad: number; fuel: number; x: number; y: number };
const SITES: Site[] = [
  { id: "tranq", name: "Sea of Tranquility", desc: "Flat basalt plains. Wide pad. Easy.", rough: 25, pad: 140, fuel: 100, x: 62, y: 42 },
  { id: "cop", name: "Copernicus Crater", desc: "Terraced crater walls. Medium.", rough: 70, pad: 100, fuel: 85, x: 40, y: 45 },
  { id: "tycho", name: "Tycho Crater", desc: "Jagged rays and central peak. Hard.", rough: 120, pad: 75, fuel: 70, x: 45, y: 75 },
  { id: "shack", name: "Shackleton (South Pole)", desc: "Steep ridges, tiny pad, low fuel. Expert.", rough: 170, pad: 55, fuel: 55, x: 50, y: 92 },
];
const COUNTRY_AREAS_KM2: Record<string, number> = { Cameroon: 475442, France: 551695, "United States": 9833520, "United States of America": 9833520, Canada: 9984670, Brazil: 8515767, India: 3287263, Japan: 377975 };

const W = 900, H = 560, GRAV = 1.62 * 9, THRUST = 4.2 * 9, TURN = 2.4, BURN = 9;
const formatLogDate = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toLocaleString();
const missionHistoryKey = "jarsig.mission-history";

function readMissionHistory(): MissionLog[] {
  try { return JSON.parse(window.localStorage.getItem(missionHistoryKey) ?? "[]") as MissionLog[]; }
  catch { return []; }
}

function saveMissionHistory(siteName: string, outcome: "landed" | "crashed", message: string) {
  const entry: MissionLog = {
    id: Date.now(), event_level: outcome === "landed" ? "INFO" : "WARN",
    message: `Simulation at ${siteName}: ${message}`, mission_time_offset: "T+00:00", logged_at: new Date(),
  };
  window.localStorage.setItem(missionHistoryKey, JSON.stringify([entry, ...readMissionHistory()].slice(0, 100)));
}

function makeTerrain(site: Site) {
  const n = 60, pts: number[] = [];
  const padStart = Math.floor(n * (0.25 + Math.random() * 0.5));
  const padLen = Math.ceil(site.pad / (W / n));
  let y = H - 120;
  for (let i = 0; i <= n; i++) {
    if (i > padStart && i <= padStart + padLen) { pts.push(pts[i - 1] ?? y); continue; }
    y += (Math.random() - 0.5) * site.rough;
    y = Math.max(H * 0.45, Math.min(H - 30, y));
    pts.push(y);
  }
  return { pts, step: W / n, padX0: padStart * (W / n), padX1: (padStart + padLen) * (W / n), padY: pts[padStart] ?? H - 120 };
}

function Play() {
  const [site, setSite] = useState<Site | null>(null);
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      {site ? <div className="mx-auto max-w-5xl px-6 py-8"><Game site={site} onBack={() => setSite(null)} /></div> : <SitePicker onPick={setSite} />}
    </main>
  );
}

function SitePicker({ onPick }: { onPick: (s: Site) => void }) {
  const [mapPoint, setMapPoint] = useState({ latitude: -85, longitude: 0 });
  const [viewMode, setViewMode] = useState<"surface" | "globe">("surface");
  const [country, setCountry] = useState("Cameroon");
  const [countryNames, setCountryNames] = useState<string[]>(["Cameroon", "France", "United States", "Canada", "Brazil", "India", "Japan"]);
  const [countryFootprint, setCountryFootprint] = useState<CountryFootprint>({ rings: [], enclosure: [] });
  const [countryError, setCountryError] = useState(false);
  useEffect(() => {
    let active = true;
    void getCountryNames().then((names) => { if (active && names.length) setCountryNames(names); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [zones, setZones] = useState<PsrZone[] | null>(null);
  const [logs, setLogs] = useState<MissionLog[]>([]);
  const [zonesUnavailable, setZonesUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    listPsrZones()
      .then((data) => { if (active) setZones(data); })
      .catch(() => { if (active) setZonesUnavailable(true); });
    if (active) setLogs(readMissionHistory());
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void getCountryFootprint(country, mapPoint)
      .then((footprint) => { if (active) { setCountryFootprint(footprint); setCountryError(false); } })
      .catch(() => { if (active) { setCountryFootprint({ rings: [], enclosure: [] }); setCountryError(true); } });
    return () => { active = false; };
  }, [country, mapPoint.latitude, mapPoint.longitude]);

  return (
    <div>
      <section className="relative h-[100svh] min-h-[38rem] overflow-hidden bg-[#08090b] text-white sm:min-h-[42rem]" aria-label="NASA Moon Trek lunar explorer">
        {viewMode === "surface" ? <NasaWmtsMap selectedPoint={mapPoint} onSelect={setMapPoint} footprint={countryFootprint} mapHeightClass="h-full" showInstructions={false} /> : <NasaMoonGlobe footprint={countryFootprint} className="h-full w-full" />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/75" />
        <header className="absolute inset-x-0 top-0 z-30 flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-10 sm:py-5">
          <Link to="/" className="pointer-events-auto text-poster text-lg">JARSIG</Link>
          <nav className="pointer-events-auto flex w-full flex-wrap justify-between gap-x-3 gap-y-2 text-[9px] uppercase tracking-widest sm:w-auto sm:justify-end sm:gap-x-5 sm:text-xs">
            <Link to="/science" search={{ latitude: -85, longitude: 0 }} className="hover:text-white/70">Sun / Earth</Link>
            <Link to="/map" className="hover:text-white/70">Map tools</Link>
            <Link to="/missions" className="border border-white/40 px-2 py-1 text-white hover:bg-white/10 sm:px-3 sm:py-2">NASA mission info</Link>
          </nav>
        </header>
        <div className="absolute inset-x-0 top-[21%] z-20 mx-auto max-w-6xl px-4 sm:top-[20%] sm:px-6">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/70 sm:text-[10px] sm:tracking-[0.35em]">NASA Moon Trek · NASA / JPL · Lunar Reconnaissance Orbiter</p>
          <h1 className="text-poster mt-3 max-w-3xl text-4xl sm:mt-4 sm:text-6xl">Choose a landing area</h1>
          <p className="mt-3 max-w-xl text-xs text-white/75 sm:mt-4 sm:text-sm">Explore NASA lunar imagery, rotate the Moon in 3D, and select a point on the surface to inspect its coordinates.</p>
        </div>
        <aside className="absolute bottom-[6.4rem] left-4 right-4 z-20 max-w-sm border border-white/25 bg-black/70 p-3 backdrop-blur sm:bottom-10 sm:left-10 sm:right-auto sm:p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/60">Selected lunar point</p>
          <p className="mt-2 font-mono text-sm">{mapPoint.latitude.toFixed(3)}° latitude · {mapPoint.longitude.toFixed(3)}° longitude</p>
          <p className="mt-2 text-xs text-white/65">{viewMode === "surface" ? "Drag to move · scroll to zoom · click to select" : "Drag the globe to rotate the lunar surface"}</p>
        </aside>
        <div className="absolute bottom-4 left-4 right-4 z-30 flex gap-2 sm:bottom-10 sm:left-auto sm:right-10">
          <button onClick={() => setViewMode("surface")} aria-pressed={viewMode === "surface"} className={`flex-1 border border-white/40 px-3 py-3 text-[10px] uppercase tracking-widest backdrop-blur sm:flex-none sm:px-4 ${viewMode === "surface" ? "bg-white text-black" : "bg-black/60 text-white"}`}>Surface map</button>
          <button onClick={() => setViewMode("globe")} aria-pressed={viewMode === "globe"} className={`flex-1 border border-white/40 px-3 py-3 text-[10px] uppercase tracking-widest backdrop-blur sm:flex-none sm:px-4 ${viewMode === "globe" ? "bg-white text-black" : "bg-black/60 text-white"}`}>3D Moon</button>
        </div>
        <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noreferrer" className="absolute right-6 top-24 z-20 text-[10px] text-white/70 underline underline-offset-4 sm:right-10">NASA Moon Trek source</a>
      </section>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:space-y-12 sm:px-6 sm:py-12">
      <section>
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Mission select</p>
      <h2 className="text-poster mt-3 text-4xl">Start a landing simulation</h2>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="border border-border p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Choose a lunar region</p>
          <p className="mt-3 text-xs text-muted-foreground">NASA LRO map · {mapPoint.latitude.toFixed(2)}°, {mapPoint.longitude.toFixed(2)}°</p>
          <Link to="/map" className="mt-3 inline-block text-xs underline underline-offset-4">Open map tools</Link>
        </div>
        <ul className="divide-y divide-border border-y border-border">
          {SITES.map((s, i) => (
            <li key={s.id}>
              <button onClick={() => onPick(s)} className="flex w-full items-baseline gap-4 py-5 text-left hover:text-glow">
                <span className="text-xs text-muted-foreground">0{i + 1}</span>
                <span>
                  <span className="block font-display text-xl font-light">{s.name}</span>
                  <span className="text-sm text-muted-foreground">{s.desc}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      </section>
      <section className="border-t border-border pt-8" aria-labelledby="country-comparison-title">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Moon Trek · Country Mover inspired comparison</p>
        <h2 id="country-comparison-title" className="mt-3 font-display text-2xl font-light">Compare a country’s area with the Moon</h2>
        <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="w-full text-sm sm:w-auto">Country <select value={country} onChange={(event) => setCountry(event.target.value)} className="mt-2 w-full border border-border bg-background px-3 py-2 sm:ml-3 sm:mt-0 sm:w-auto">{countryNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <p className="text-sm text-muted-foreground">{COUNTRY_AREAS_KM2[country] ? `${country} covers about ${COUNTRY_AREAS_KM2[country]!.toLocaleString()} km², compared with the Moon’s 37.9 million km² surface.` : `The outline of ${country} is projected onto the Moon. Area data is not available for this comparison.`}</p>
        </div>
        {COUNTRY_AREAS_KM2[country] && <div className="mt-4 h-3 max-w-2xl overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-glow" style={{ width: `${Math.max(1, COUNTRY_AREAS_KM2[country]! / 37900000 * 100)}%` }} /></div>}
        <p className="mt-2 text-xs text-muted-foreground">The selected country’s yellow outline is projected onto the lunar surface at the selected coordinates. Drag the 2D map or rotate the 3D Moon to inspect it.</p>
        {countryError && <p role="status" className="mt-2 text-xs text-muted-foreground">The country outline could not be loaded. Check your connection, then refresh the page.</p>}
      </section>
      <section className="mt-12 border-t border-border pt-8" aria-labelledby="artemis-sites-title">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">NASA Artemis south-pole candidates</p>
        <h2 id="artemis-sites-title" className="mt-3 font-display text-2xl font-light">Analyze a representative landing point</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">These are representative coordinates from a published landing-site study in NASA’s candidate regions. They are analysis points, not final mission selections.</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LUNAR_REFERENCE_SITES.map((point) => (
            <li key={point.id} className="border border-border p-4">
              <p className="font-display text-lg">{point.name} <span className="text-xs text-muted-foreground">{point.id}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{point.latitude.toFixed(3)}°, {point.longitude.toFixed(3)}° east</p>
              <Link to="/science" search={{ latitude: point.latitude, longitude: point.longitude }} className="mt-3 inline-block text-xs underline underline-offset-4">Analyze with JPL Horizons</Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">Region status: <a href={NASA_ARTEMIS_REGIONS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">NASA’s updated candidate list</a> · Representative coordinates: <a href={SITE_COORDINATES_SOURCE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">peer-reviewed study</a>.</p>
      </section>
      <section className="mt-14 border-t border-border pt-8" aria-labelledby="psr-catalog-title">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">PostgreSQL mission data</p>
        <h2 id="psr-catalog-title" className="mt-3 font-display text-2xl font-light">Permanent shadow regions</h2>
        {zones === null && !zonesUnavailable && <p className="mt-3 text-sm text-muted-foreground">Loading regions…</p>}
        {zonesUnavailable && <p className="mt-3 text-sm text-muted-foreground">Region data is unavailable. Configure DATABASE_URL and load the database schema to display it.</p>}
        {zones?.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No regions are recorded in the database yet.</p>}
        {!!zones?.length && (
          <div className="mt-5 overflow-x-auto border-y border-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                <tr><th className="py-3 pr-4 font-normal">Crater</th><th className="py-3 pr-4 font-normal">Latitude</th><th className="py-3 pr-4 font-normal">Longitude</th><th className="py-3 pr-4 font-normal">Radius</th><th className="py-3 pr-4 font-normal">Ice probability</th><th className="py-3 font-normal">Data source</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {zones.map((zone) => (
                  <tr key={zone.id}>
                    <td className="py-3 pr-4">{zone.crater_name}</td>
                    <td className="py-3 pr-4">{zone.latitude.toFixed(3)}°</td>
                    <td className="py-3 pr-4">{zone.longitude.toFixed(3)}°</td>
                    <td className="py-3 pr-4">{zone.radius_km} km</td>
                    <td className="py-3 pr-4">{zone.ice_probability_pct == null ? "Not recorded" : `${zone.ice_probability_pct}%`}</td>
                    <td className="py-3">{zone.source_url ? <a href={zone.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{zone.source_name ?? "Source"}</a> : zone.source_name ?? "Not recorded"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="mt-12 border-t border-border pt-8">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Your database mission history</p>
        <h2 className="mt-3 font-display text-2xl font-light">Recent simulator outcomes</h2>
        {logs.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No saved outcomes yet.</p> : <ul className="mt-4 divide-y divide-border border-y border-border">{logs.slice(0, 10).map((log) => <li key={log.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span><span className="mr-3 text-xs text-muted-foreground">{log.event_level}</span>{log.message}</span><span className="text-xs text-muted-foreground">{formatLogDate(log.logged_at)}</span></li>)}</ul>}
      </section>
      </div>
    </div>
  );
}

function Game({ site, onBack }: { site: Site; onBack: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useRef({ up: false, left: false, right: false });
  const [status, setStatus] = useState<"flying" | "landed" | "crashed">("flying");
  const [note, setNote] = useState("");
  const [round, setRound] = useState(0);

  useEffect(() => {
    const k = (v: boolean) => (e: KeyboardEvent) => {
      if (["ArrowUp", "w", "W", " "].includes(e.key)) keys.current.up = v;
      if (["ArrowLeft", "a", "A"].includes(e.key)) keys.current.left = v;
      if (["ArrowRight", "d", "D"].includes(e.key)) keys.current.right = v;
      if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault();
    };
    const dn = k(true), up = k(false);
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const ctx = canvas.current!.getContext("2d")!;
    const t = makeTerrain(site);
    const stars = Array.from({ length: 120 }, () => [Math.random() * W, Math.random() * H * 0.6, Math.random()]);
    const s = { x: 80 + Math.random() * (W - 160), y: 60, vx: (Math.random() - 0.5) * 40, vy: 0, a: 0, fuel: site.fuel, done: false };
    setStatus("flying"); setNote("");
    const css = getComputedStyle(document.documentElement);
    const glow = css.getPropertyValue("--glow"), fg = css.getPropertyValue("--foreground"), muted = css.getPropertyValue("--muted-foreground");
    let last = performance.now(), raf = 0;
    const groundAt = (x: number) => { const i = Math.max(0, Math.min(t.pts.length - 2, Math.floor(x / t.step))); const f = x / t.step - i; return (t.pts[i] ?? H) * (1 - f) + (t.pts[i + 1] ?? H) * f; };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const kk = keys.current, thrusting = kk.up && s.fuel > 0 && !s.done;
      if (!s.done) {
        if (kk.left) s.a -= TURN * dt;
        if (kk.right) s.a += TURN * dt;
        s.vy += GRAV * dt;
        if (thrusting) { s.vx += Math.sin(s.a) * THRUST * dt; s.vy -= Math.cos(s.a) * THRUST * dt; s.fuel = Math.max(0, s.fuel - BURN * dt); }
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x < 0) s.x += W; if (s.x > W) s.x -= W;
        if (s.y + 12 >= groundAt(s.x)) {
          s.done = true;
          const onPad = s.x - 10 >= t.padX0 && s.x + 10 <= t.padX1;
          const deg = Math.abs(((s.a * 180) / Math.PI) % 360);
          const ok = onPad && s.vy < 20 && Math.abs(s.vx) < 12 && deg < 12;
          setStatus(ok ? "landed" : "crashed");
          const resultNote = ok ? `Touchdown at ${(s.vy / 9).toFixed(1)} m/s with ${s.fuel.toFixed(0)}% fuel left.`
            : !onPad ? "Missed the landing pad." : s.vy >= 20 ? `Too fast: ${(s.vy / 9).toFixed(1)} m/s.` : Math.abs(s.vx) >= 12 ? "Too much sideways drift." : "Not upright.";
          setNote(resultNote);
          saveMissionHistory(site.name, ok ? "landed" : "crashed", resultNote);
        }
      }
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      for (const [x = 0, y = 0, b = 0] of stars) { ctx.fillStyle = `rgba(255,255,255,${0.2 + b * 0.6})`; ctx.fillRect(x, y, 1.5, 1.5); }
      ctx.beginPath(); ctx.moveTo(0, H);
      t.pts.forEach((y, i) => ctx.lineTo(i * t.step, y)); ctx.lineTo(W, H); ctx.closePath();
      ctx.fillStyle = "#1c1c1e"; ctx.fill(); ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = glow; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(t.padX0, t.padY); ctx.lineTo(t.padX1, t.padY); ctx.stroke();
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.strokeStyle = fg; ctx.lineWidth = 1.5;
      ctx.strokeRect(-8, -10, 16, 14);
      ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-12, 12); ctx.moveTo(8, 4); ctx.lineTo(12, 12); ctx.stroke();
      if (thrusting) { ctx.fillStyle = glow; ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(0, 14 + Math.random() * 10); ctx.lineTo(5, 5); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = fg; ctx.font = "13px 'DM Sans'";
      ctx.fillText(`FUEL ${s.fuel.toFixed(0)}%`, 20, 28);
      ctx.fillText(`DESCENT ${(s.vy / 9).toFixed(1)} m/s`, 20, 48);
      ctx.fillText(`DRIFT ${(s.vx / 9).toFixed(1)} m/s`, 20, 68);
      ctx.fillText(`ALT ${Math.max(0, (groundAt(s.x) - s.y - 12) / 4).toFixed(0)} m`, 20, 88);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    canvas.current!.dataset["sceneReady"] = "true";
    return () => cancelAnimationFrame(raf);
  }, [site, round]);

  const hold = (k: "up" | "left" | "right") => ({
    onPointerDown: () => { keys.current[k] = true; }, onPointerUp: () => { keys.current[k] = false; }, onPointerLeave: () => { keys.current[k] = false; },
  });
  const btn = "border border-border px-5 py-3 text-xs uppercase tracking-widest select-none touch-none";
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Landing zone</p>
          <h1 className="text-poster mt-2 text-4xl">{site.name}</h1>
        </div>
        <button onClick={onBack} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">← Change area</button>
      </div>
      <div className="relative mt-6">
        <canvas ref={canvas} width={W} height={H} className="w-full border border-border" />
        {status !== "flying" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 text-center">
            <h2 className="text-poster text-3xl sm:text-5xl">{status === "landed" ? "The Eagle has landed" : "Mission lost"}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{note}</p>
            <button onClick={() => setRound((r) => r + 1)} className="mt-6 border border-foreground px-8 py-3 text-xs uppercase tracking-widest hover:bg-foreground hover:text-background">Try again</button>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">↑ / W / Space: thrust · ← → / A D: rotate · Land softly and upright on the blue pad.</p>
        <div className="flex gap-2">
          <button className={btn} {...hold("left")}>⟲</button>
          <button className={btn} {...hold("up")}>Thrust</button>
          <button className={btn} {...hold("right")}>⟳</button>
        </div>
      </div>
    </div>
  );
}
