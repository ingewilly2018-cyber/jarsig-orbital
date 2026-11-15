import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const isLanding = useRouterState({ select: (state) => state.location.pathname === "/play" });
  return (
    <>
      {!isLanding && <nav className="border-b border-border bg-background px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 text-[10px] uppercase tracking-wider sm:gap-x-7 sm:text-xs sm:tracking-widest">
          <Link to="/" className="text-poster mr-1 text-base sm:mr-3">JARSIG</Link>
          <Link to="/play" className="text-muted-foreground hover:text-foreground">Landing</Link>
          <Link to="/science" search={{ latitude: -85, longitude: 0 }} className="text-muted-foreground hover:text-foreground">Sun / Earth</Link>
          <Link to="/map" className="text-muted-foreground hover:text-foreground">Lunar map</Link>
          <Link to="/missions" className="border border-border px-2 py-2 text-foreground hover:border-foreground sm:px-3">NASA mission info</Link>
        </div>
      </nav>}
      <Outlet />
    </>
  );
}
