import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { NasaWmtsMap } from "@/components/NasaWmtsMap";
import { LUNAR_REFERENCE_SITES, NASA_ARTEMIS_REGIONS_URL, SITE_COORDINATES_SOURCE_URL } from "@/lib/lunar-sites";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({ meta: [{ title: "Lunar map — JARSIG" }, { name: "description", content: "Explore the Moon with NASA Moon Trek." }] }),
  component: LunarMapPage,
});

function LunarMapPage() {
  const [latitude, setLatitude] = useState("-89.5");
  const [longitude, setLongitude] = useState("0");
  const [referenceSite, setReferenceSite] = useState("");
  const input = "w-full border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-glow";
  return (
    <main className="min-h-screen bg-background px-6 py-10 font-sans text-foreground">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">NASA Moon Trek · LROC</p>
        <h1 className="text-poster mt-3 text-5xl md:text-6xl">Lunar surface map</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">Explore NASA’s LRO Wide Angle Camera lunar mosaic directly in this map. Pan, zoom, and click the surface to select coordinates for JPL Horizons; load a published Artemis south-pole reference point to jump to its location.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted-foreground">Artemis reference point<select className={`${input} mt-2`} value={referenceSite} onChange={(e) => { const point = LUNAR_REFERENCE_SITES.find((site) => site.id === e.target.value); setReferenceSite(point?.id ?? ""); if (point) { setLatitude(String(point.latitude)); setLongitude(String(point.longitude)); } }}><option value="">Custom coordinates</option>{LUNAR_REFERENCE_SITES.map((point) => <option key={point.id} value={point.id}>{point.name} · {point.id}</option>)}</select></label>
          <label className="text-xs text-muted-foreground">Selected latitude °<input type="number" step="any" min="-90" max="90" className={`${input} mt-2`} value={latitude} onChange={(e) => { setReferenceSite(""); setLatitude(e.target.value); }} /></label>
          <label className="text-xs text-muted-foreground">East longitude °<input type="number" step="any" min="-180" max="180" className={`${input} mt-2`} value={longitude} onChange={(e) => { setReferenceSite(""); setLongitude(e.target.value); }} /></label>
          <div className="flex flex-wrap items-end gap-3"><Link to="/science" search={{ latitude: Number(latitude), longitude: Number(longitude) }} className="border border-foreground px-5 py-3 text-xs uppercase tracking-widest hover:bg-foreground hover:text-background">Analyze this point</Link></div>
        </div>
        <div className="mt-6"><NasaWmtsMap selectedPoint={{ latitude: Number(latitude), longitude: Number(longitude) }} onSelect={(point) => { setReferenceSite(""); setLatitude(point.latitude.toFixed(5)); setLongitude(point.longitude.toFixed(5)); }} focusKey={referenceSite} /></div>
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
          <span>Selected point: {Number(latitude).toFixed(3)}° latitude, {Number(longitude).toFixed(3)}° east longitude</span>
          <span>NASA/JPL WMTS basemap · LRO LROC WAC global mosaic</span>
        </div>
        {referenceSite && <p className="mt-3 text-xs text-muted-foreground">Reference coordinates from a published candidate-site study (<a href={SITE_COORDINATES_SOURCE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">coordinate source</a>). NASA candidate-region list: <a href={NASA_ARTEMIS_REGIONS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">NASA</a>.</p>}
        <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-5 text-xs"><a href="https://trek.nasa.gov/moon/" target="_blank" rel="noreferrer" className="underline underline-offset-4">Open full NASA Moon Trek layers and terrain tools</a><a href="https://quickmap.lroc.asu.edu/" target="_blank" rel="noreferrer" className="underline underline-offset-4">Open LROC QuickMap imagery and elevation tools</a></div>
        <p className="mt-4 text-xs text-muted-foreground">This basemap provides imagery and coordinates. Detailed elevation and local terrain shadow analysis remain available in the linked mission-planning tools; the JPL horizon analysis is geometric.</p>
      </div>
    </main>
  );
}
