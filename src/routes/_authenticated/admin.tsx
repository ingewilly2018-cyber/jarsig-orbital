import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getAdminOverview, listAdminUsers, listPsrZones, listSurfaceAssets, savePsrZone, updateAdminUser, type AdminUser, type PsrZone, type SurfaceAsset } from "@/lib/database.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administration — JARSIG" }, { name: "description", content: "Manage JARSIG user accounts." }] }),
  beforeLoad: () => { throw redirect({ to: "/play" }); },
  component: AdminPage,
});

type Overview = { counts: { users: number; admins: number; active: number; disabled: number }; recentUsers: AdminUser[] };
const formatDate = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toLocaleString();

function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [zones, setZones] = useState<PsrZone[]>([]);
  const [assets, setAssets] = useState<SurfaceAsset[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "USER" | "ADMIN">("all");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [zoneMessage, setZoneMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [summary, list, psrZones, assetList] = await Promise.all([getAdminOverview(), listAdminUsers({ data: { search, role } }), listPsrZones(), listSurfaceAssets()]);
      setOverview(summary); setUsers(list); setZones(psrZones); setAssets(assetList); setError("");
    } catch {
      setError("Administrator access is required. Make sure your account is marked ADMIN in the database.");
    }
  }, [search, role]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function update(user: AdminUser, changes: { isAdmin: boolean; isActive: boolean }) {
    const action = changes.isAdmin !== user.is_admin ? (changes.isAdmin ? "grant administrator access to" : "remove administrator access from") : (changes.isActive ? "activate" : "disable");
    if (!window.confirm(`Are you sure you want to ${action} ${user.email}?`)) return;
    setBusyId(user.id);
    try { await updateAdminUser({ data: { id: user.id, ...changes } }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "The change could not be saved."); }
    finally { setBusyId(null); }
  }

  async function submitZone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setZoneMessage("");
    try {
      await savePsrZone({ data: {
        craterName: String(form.get("craterName")), latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")),
        radiusKm: Number(form.get("radiusKm")), iceProbabilityPct: form.get("iceProbabilityPct") === "" ? null : Number(form.get("iceProbabilityPct")),
        permanentShadow: form.get("permanentShadow") === "on", sourceName: String(form.get("sourceName")), sourceUrl: String(form.get("sourceUrl")),
      } });
      setZoneMessage("PSR region saved with its source.");
      formElement.reset();
      setZones(await listPsrZones());
    } catch (err) { setZoneMessage(err instanceof Error ? err.message : "Could not save this region."); }
  }

  const card = "border border-border p-5";
  return (
    <main className="min-h-screen bg-background px-6 py-10 font-sans text-foreground">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Access restricted · Database roles</p>
        <h1 className="text-poster mt-3 text-5xl">Administration</h1>
        {error && <p className="mt-6 border border-destructive px-4 py-3 text-sm" role="alert">{error}</p>}
        {overview && <>
          <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[["Users", overview.counts.users], ["Administrators", overview.counts.admins], ["Active", overview.counts.active], ["Disabled", overview.counts.disabled]].map(([label, value]) => <div key={label} className={card}><p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-2 text-3xl">{value}</p></div>)}
          </section>
          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><h2 className="font-display text-2xl">User accounts</h2><p className="mt-1 text-sm text-muted-foreground">Promote existing users, update account status, and review recent sign-ups.</p></div>
              <div className="flex gap-3"><input aria-label="Search users" className="border border-border bg-transparent px-3 py-2 text-sm" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filter by role" className="border border-border bg-background px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="all">All roles</option><option value="USER">Users</option><option value="ADMIN">Admins</option></select></div>
            </div>
            <div className="mt-5 overflow-x-auto border-y border-border">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-widest text-muted-foreground"><tr><th className="py-3 pr-4 font-normal">Username / email</th><th className="py-3 pr-4 font-normal">Role</th><th className="py-3 pr-4 font-normal">Status</th><th className="py-3 pr-4 font-normal">Joined</th><th className="py-3 font-normal">Actions</th></tr></thead>
                <tbody className="divide-y divide-border">{users.map((user) => <tr key={user.id}><td className="py-4 pr-4"><span className="block">{user.username}</span><span className="text-xs text-muted-foreground">{user.email}</span></td><td className="py-4 pr-4">{user.is_admin ? "ADMIN" : "USER"}</td><td className="py-4 pr-4">{user.is_active ? "Active" : "Disabled"}</td><td className="py-4 pr-4">{formatDate(user.created_at)}</td><td className="py-4"><div className="flex flex-wrap gap-2"><button disabled={busyId === user.id} onClick={() => update(user, { isAdmin: !user.is_admin, isActive: user.is_active })} className="underline underline-offset-4 disabled:opacity-50">{user.is_admin ? "Remove admin" : "Make admin"}</button><button disabled={busyId === user.id} onClick={() => update(user, { isAdmin: user.is_admin, isActive: !user.is_active })} className="ml-3 underline underline-offset-4 disabled:opacity-50">{user.is_active ? "Disable" : "Activate"}</button></div></td></tr>)}</tbody>
              </table>
              {users.length === 0 && <p className="py-6 text-sm text-muted-foreground">No matching users.</p>}
            </div>
          </section>
          <section className="mt-10"><h2 className="font-display text-xl">Recent sign-ups</h2><ul className="mt-3 divide-y divide-border border-y border-border">{overview.recentUsers.map((user) => <li key={user.id} className="flex justify-between gap-3 py-3 text-sm"><span>{user.email}</span><span className="text-muted-foreground">{formatDate(user.created_at)}</span></li>)}</ul></section>
          <section className="mt-12 border-t border-border pt-8"><h2 className="font-display text-2xl">PSR region catalogue</h2><p className="mt-2 text-sm text-muted-foreground">Record coordinates and attach a source link. These entries are shown in the mission and analysis pages.</p>
            <form onSubmit={submitZone} className="mt-5 grid gap-3 border-y border-border py-5 sm:grid-cols-2 lg:grid-cols-4">
              <input name="craterName" required maxLength={100} placeholder="Crater or region name" className="border border-border bg-transparent px-3 py-2 text-sm" />
              <input name="latitude" required type="number" min="-90" max="90" step="any" placeholder="Latitude °" className="border border-border bg-transparent px-3 py-2 text-sm" />
              <input name="longitude" required type="number" min="-180" max="180" step="any" placeholder="East longitude °" className="border border-border bg-transparent px-3 py-2 text-sm" />
              <input name="radiusKm" required type="number" min="0.01" max="2000" step="any" placeholder="Radius km" className="border border-border bg-transparent px-3 py-2 text-sm" />
              <input name="iceProbabilityPct" type="number" min="0" max="100" step="1" placeholder="Ice probability % (optional)" className="border border-border bg-transparent px-3 py-2 text-sm" />
              <input name="sourceName" required maxLength={100} placeholder="Source name" className="border border-border bg-transparent px-3 py-2 text-sm" />
              <input name="sourceUrl" required type="url" placeholder="Source URL" className="border border-border bg-transparent px-3 py-2 text-sm lg:col-span-2" />
              <label className="flex items-center gap-2 text-sm"><input name="permanentShadow" type="checkbox" defaultChecked />Permanent shadow</label>
              <button className="border border-foreground px-4 py-2 text-xs uppercase tracking-widest hover:bg-foreground hover:text-background">Save region</button>
              {zoneMessage && <p className="self-center text-sm text-muted-foreground" role="status">{zoneMessage}</p>}
            </form>
            {zones.length > 0 && <ul className="divide-y divide-border">{zones.map((zone) => <li key={zone.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{zone.crater_name} · {zone.latitude.toFixed(3)}°, {zone.longitude.toFixed(3)}°</span><span className="text-muted-foreground">{zone.source_name ?? "Source not recorded"}</span></li>)}</ul>}
          </section>
          <section className="mt-12 border-t border-border pt-8"><h2 className="font-display text-2xl">Surface assets</h2><p className="mt-2 text-sm text-muted-foreground">Current database telemetry. This view contains only records already supplied to the database.</p>{assets.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No assets are recorded.</p> : <div className="mt-4 overflow-x-auto border-y border-border"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="text-xs uppercase tracking-widest text-muted-foreground"><tr><th className="py-3 pr-4 font-normal">Asset</th><th className="py-3 pr-4 font-normal">Type</th><th className="py-3 pr-4 font-normal">Status</th><th className="py-3 pr-4 font-normal">Battery</th><th className="py-3 font-normal">Updated</th></tr></thead><tbody className="divide-y divide-border">{assets.map((asset) => <tr key={asset.asset_id}><td className="py-3 pr-4">{asset.name}</td><td className="py-3 pr-4">{asset.asset_type}</td><td className="py-3 pr-4">{asset.status}</td><td className="py-3 pr-4">{asset.battery_pct}</td><td className="py-3">{formatDate(asset.last_updated)}</td></tr>)}</tbody></table></div>}</section>
        </>}
      </div>
    </main>
  );
}
