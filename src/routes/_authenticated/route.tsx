import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { syncMyDatabaseAccount } from "@/lib/database.functions";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    let account: Awaited<ReturnType<typeof syncMyDatabaseAccount>>;
    try {
      account = await syncMyDatabaseAccount();
    } catch (error) {
      if (error instanceof Response) throw error;
      throw redirect({ to: "/auth" });
    }
    if (!account.active) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (account.passwordChangeRequired && location.pathname !== "/change-password") {
      throw redirect({ to: "/change-password" });
    }
  },
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    syncMyDatabaseAccount().then((account) => { if (active) setIsAdmin(account.isAdmin); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return (
    <>
      <nav className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-3 text-xs uppercase tracking-widest">
          <Link to="/" className="text-poster mr-3 text-base">JARSIG</Link>
          <Link to="/play" className="text-muted-foreground hover:text-foreground">Landing</Link>
          <Link to="/science" search={{ latitude: -85, longitude: 0 }} className="text-muted-foreground hover:text-foreground">Sun / Earth</Link>
          <Link to="/map" className="text-muted-foreground hover:text-foreground">Lunar map</Link>
          <Link to="/missions" className="text-muted-foreground hover:text-foreground">Mission briefings</Link>
          {isAdmin && <Link to="/admin" className="text-muted-foreground hover:text-foreground">Admin</Link>}
        </div>
      </nav>
      <Outlet />
    </>
  );
}
