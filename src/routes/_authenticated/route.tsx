import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const isLanding = useRouterState({ select: (state) => state.location.pathname === "/play" });
  return (
    <>
      {!isLanding && <nav className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-3 text-xs uppercase tracking-widest">
          <Link to="/" className="text-poster mr-3 text-base">JARSIG</Link>
          <Link to="/play" className="text-muted-foreground hover:text-foreground">Landing</Link>
          <Link to="/science" search={{ latitude: -85, longitude: 0 }} className="text-muted-foreground hover:text-foreground">Sun / Earth</Link>
          <Link to="/map" className="text-muted-foreground hover:text-foreground">Lunar map</Link>
          <Link to="/missions" className="text-muted-foreground hover:text-foreground">Mission information</Link>
        </div>
      </nav>}
      <Outlet />
    </>
  );
}
