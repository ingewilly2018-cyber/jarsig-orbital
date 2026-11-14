import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HalftoneSphere } from "@/components/HalftoneSphere";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JARSIG — Space Project" },
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
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <span className="text-poster text-lg">JARSIG</span>
        <nav className="flex gap-8 text-xs uppercase tracking-widest text-muted-foreground">
          <a href="#mission" className="hover:text-foreground transition-colors">Mission</a>
          <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          {signedIn ? (
            <>
              <Link to="/play" className="text-foreground hover:text-glow transition-colors">Play</Link>
              <button onClick={() => supabase.auth.signOut()} className="hover:text-foreground transition-colors uppercase tracking-widest">Sign out</button>
            </>
          ) : (
            <Link to="/auth" className="text-foreground hover:text-glow transition-colors">Sign in</Link>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <p className="mb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">Space Project — Est. 2026</p>
          <h1 className="text-poster text-7xl md:text-9xl">JARSIG</h1>
          <p className="mt-6 max-w-md text-xs uppercase leading-relaxed tracking-[0.2em] text-foreground">Open source · helping the new generation train autonomous spacecraft to land, no matter the scenario</p>
          <p className="mt-4 max-w-sm text-muted-foreground">Looking up, reaching out. A quiet pursuit of the unknown.</p>
          <div className="mt-10 flex flex-wrap gap-4">
          <a href="#mission" className="inline-block border border-border px-8 py-3 text-xs uppercase tracking-widest transition-colors hover:border-foreground">Discover</a>
          <Link to={signedIn ? "/play" : "/auth"} className="inline-block border border-foreground px-8 py-3 text-xs uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background">
            {signedIn ? "Start a landing" : "Sign in to play"}
          </Link>
          </div>
        </div>
        <HalftoneSphere className="w-full max-w-lg justify-self-center" />
      </section>

      <section id="mission" className="mx-auto grid max-w-6xl gap-px border-t border-border px-6 py-24 md:grid-cols-3">
        {items.map(([n, t, d]) => (
          <div key={n} className="py-8 md:pr-10">
            <span className="text-xs text-muted-foreground">{n}</span>
            <h2 className="mt-4 font-display text-2xl font-light">{t}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <footer id="contact" className="mx-auto flex max-w-6xl justify-between border-t border-border px-6 py-10 text-xs text-muted-foreground">
        <span>© 2026 JARSIG</span>
        <a href="mailto:hello@jarsig.space" className="hover:text-foreground">hello@jarsig.space</a>
      </footer>
    </main>
  );
}
