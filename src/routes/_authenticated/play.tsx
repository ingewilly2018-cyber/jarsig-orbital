import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const W = 900, H = 560, GRAV = 1.62 * 9, THRUST = 4.2 * 9, TURN = 2.4, BURN = 9;

function makeTerrain(site: Site) {
  const n = 60, pts: number[] = [];
  const padStart = Math.floor(n * (0.25 + Math.random() * 0.5));
  const padLen = Math.ceil(site.pad / (W / n));
  let y = H - 120;
  for (let i = 0; i <= n; i++) {
    if (i > padStart && i <= padStart + padLen) { pts.push(pts[i - 1]); continue; }
    y += (Math.random() - 0.5) * site.rough;
    y = Math.max(H * 0.45, Math.min(H - 30, y));
    pts.push(y);
  }
  return { pts, step: W / n, padX0: padStart * (W / n), padX1: (padStart + padLen) * (W / n), padY: pts[padStart] };
}

function Play() {
  const [site, setSite] = useState<Site | null>(null);
  return (
    <main className="min-h-screen bg-background px-6 py-8 font-sans text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Link to="/" className="text-poster text-lg">JARSIG</Link>
        <button onClick={() => supabase.auth.signOut()} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">Sign out</button>
      </header>
      <div className="mx-auto mt-10 max-w-5xl">
        {site ? <Game site={site} onBack={() => setSite(null)} /> : <SitePicker onPick={setSite} />}
      </div>
    </main>
  );
}

function SitePicker({ onPick }: { onPick: (s: Site) => void }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Mission select</p>
      <h1 className="text-poster mt-3 text-5xl">Choose a landing area</h1>
      <div className="mt-10 grid items-center gap-10 md:grid-cols-2">
        <div className="relative mx-auto aspect-square w-full max-w-sm rounded-full border border-border" style={{ background: "radial-gradient(circle at 35% 30%, oklch(0.55 0 0), oklch(0.2 0 0) 70%)" }}>
          {SITES.map((s) => (
            <button key={s.id} onClick={() => onPick(s)} title={s.name} style={{ left: `${s.x}%`, top: `${s.y}%` }}
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-glow bg-background transition-transform hover:scale-150" />
          ))}
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
    const groundAt = (x: number) => { const i = Math.max(0, Math.min(t.pts.length - 2, Math.floor(x / t.step))); const f = x / t.step - i; return t.pts[i] * (1 - f) + t.pts[i + 1] * f; };

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
          setNote(ok ? `Touchdown at ${(s.vy / 9).toFixed(1)} m/s with ${s.fuel.toFixed(0)}% fuel left.`
            : !onPad ? "Missed the landing pad." : s.vy >= 20 ? `Too fast: ${(s.vy / 9).toFixed(1)} m/s.` : Math.abs(s.vx) >= 12 ? "Too much sideways drift." : "Not upright.");
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
            <h2 className="text-poster text-5xl">{status === "landed" ? "The Eagle has landed" : "Mission lost"}</h2>
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
