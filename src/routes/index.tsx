import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { HalftoneSphere } from "@/components/HalftoneSphere";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JARSIG : Space Project" },
      { name: "description", content: "Open-source space landing innovation helping the new generation train autonomous spacecraft to land in any scenario." },
      { property: "og:title", content: "JARSIG — Space Project" },
      { property: "og:description", content: "Open-source space landing innovation helping the new generation train autonomous spacecraft to land in any scenario." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const items = [
  ["01", "Observe", "Mapping the sky with precision instruments."],
  ["02", "Explore", "Designing missions beyond low orbit."],
  ["03", "Share", "Open data for the curious and the bold."],
];

function Index() {
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  function accessSite(event: ReactMouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (launching) return;
    setLaunching(true);
    const mobile = window.innerWidth < 768;
    window.dispatchEvent(new CustomEvent("jarsig:launch", { detail: { x: mobile ? 0.5 : 0.74, y: mobile ? 0.77 : 0.52 } }));
    window.setTimeout(() => { void navigate({ to: "/play" }); }, 900);
  }
  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 sm:py-8">
        <span className="text-poster text-lg">JARSIG</span>
        <nav className="flex flex-wrap justify-end gap-x-3 gap-y-2 text-[10px] uppercase tracking-wider text-muted-foreground sm:gap-x-8 sm:text-xs sm:tracking-widest">
          <a href="#mission" className="hover:text-foreground transition-colors">Mission</a>
          <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          <Link to="/play" onClick={accessSite} className="text-foreground hover:text-glow transition-colors">{launching ? "Entering orbit…" : "Access to the site"}</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-2 md:gap-12 md:py-24">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <p className="mb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">Space Project — Est. 2026</p>
          <h1 className="text-poster text-6xl sm:text-7xl md:text-9xl">JARSIG</h1>
          <p className="mt-6 max-w-md text-xs uppercase leading-relaxed tracking-[0.2em] text-foreground">Open source · helping the new generation train autonomous spacecraft to land, no matter the scenario</p>
          <p className="mt-4 max-w-sm text-muted-foreground">Looking up, reaching out. A quiet pursuit of the unknown.</p>
          <div className="mt-10 flex flex-wrap gap-4">
          <a href="#mission" className="inline-block border border-border px-8 py-3 text-xs uppercase tracking-widest transition-colors hover:border-foreground">Discover</a>
          <Link to="/play" onClick={accessSite} className="inline-block border border-foreground px-8 py-3 text-xs uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background">
            {launching ? "Entering orbit…" : "Access to the site"}
          </Link>
          </div>
        </div>
        <HalftoneSphere className="w-full max-w-lg justify-self-center" />
      </section>

      <section id="mission" className="mx-auto grid max-w-6xl gap-px border-t border-border px-4 py-14 sm:px-6 sm:py-24 md:grid-cols-3">
        {items.map(([n, t, d]) => (
          <div key={n} className="py-8 md:pr-10">
            <span className="text-xs text-muted-foreground">{n}</span>
            <h2 className="mt-4 font-display text-2xl font-light">{t}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <footer id="contact" className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-border px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6 sm:py-10">
        <span>© 2026 JARSIG</span>
        <a href="mailto:hello@jarsig.space" className="hover:text-foreground">hello@jarsig.space</a>
      </footer>
    </main>
  );
}
