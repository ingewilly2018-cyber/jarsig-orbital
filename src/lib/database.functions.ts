import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const accountClaims = (claims: unknown) => claims as { sub?: string; email?: string };

async function requireAdmin(db: typeof import("./db.server").db, sub?: string) {
  if (!sub) throw new Response("Forbidden", { status: 403 });
  const [account] = await db<{ is_admin: boolean; is_active: boolean }[]>`
    SELECT is_admin, is_active FROM users WHERE supabase_user_id = ${sub} LIMIT 1
  `;
  if (!account?.is_active || !account.is_admin) throw new Response("Forbidden", { status: 403 });
}

export type PsrZone = {
  id: number;
  crater_name: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  ice_probability_pct: number | null;
  permanent_shadow: boolean;
  source_name: string | null;
  source_url: string | null;
};

export type SurfaceAsset = {
  asset_id: string;
  name: string;
  asset_type: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  status: string;
  battery_pct: string;
  last_updated: Date;
};

export type MissionLog = {
  id: number;
  event_level: string;
  message: string;
  mission_time_offset: string;
  logged_at: Date;
};

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: Date;
};

/** Link a signed-in Supabase identity to the local user record. */
export const syncMyDatabaseAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ active: boolean; passwordChangeRequired: boolean; isAdmin: boolean }> => {
    const claims = accountClaims(context.claims);
    if (!claims.sub || !claims.email) throw new Response("Account email is unavailable", { status: 401 });

    const { db } = await import("./db.server");
    const subject = claims.sub;
    const email = claims.email.toLowerCase();
    const username = `${(email.split("@")[0] ?? "pilot").slice(0, 38)}-${subject.slice(0, 8)}`;
    await db`
      INSERT INTO users (username, email, supabase_user_id, is_admin, is_active)
      VALUES (${username}, ${email}, ${subject}, FALSE, TRUE)
      ON CONFLICT (email) DO UPDATE SET
        supabase_user_id = CASE WHEN users.is_admin THEN users.supabase_user_id ELSE COALESCE(users.supabase_user_id, EXCLUDED.supabase_user_id) END,
        updated_at = CURRENT_TIMESTAMP
    `;

    const [account] = await db<{ is_active: boolean; password_change_required: boolean; is_admin: boolean }[]>`
      SELECT is_active, password_change_required, is_admin FROM users WHERE supabase_user_id = ${subject} LIMIT 1
    `;
    if (!account) throw new Response("Account could not be linked to the mission database", { status: 409 });
    return { active: account.is_active, passwordChangeRequired: account.password_change_required, isAdmin: account.is_admin };
  });

export const completeInitialPasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<void> => {
    const claims = accountClaims(context.claims);
    if (!claims.sub) throw new Response("Unauthorized", { status: 401 });
    const { db } = await import("./db.server");
    const changed = await db`
      UPDATE users SET password_change_required = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE supabase_user_id = ${claims.sub} AND is_active AND password_change_required
      RETURNING id
    `;
    if (changed.count !== 1) throw new Response("No initial password change is pending", { status: 409 });
  });

/** PSR zone catalog is reference data and can be read without signing in. */
export const listPsrZones = createServerFn({ method: "GET" }).handler(async (): Promise<PsrZone[]> => {
  const { db } = await import("./db.server");
  return db<PsrZone[]>`
    SELECT id, crater_name, latitude, longitude, radius_km,
           ice_probability_pct, permanent_shadow, source_name, source_url
    FROM psr_zones ORDER BY crater_name
  `;
});

export const listSurfaceAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SurfaceAsset[]> => {
    const { db } = await import("./db.server");
    const claims = accountClaims(context.claims);
    await requireAdmin(db, claims.sub);
    return db<SurfaceAsset[]>`
      SELECT asset_id, name, asset_type, pos_x, pos_y, pos_z,
             status, battery_pct, last_updated FROM surface_assets ORDER BY name
    `;
  });

export const listMyMissionLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MissionLog[]> => {
    const claims = accountClaims(context.claims);
    if (!claims.sub) return [];
    const { db } = await import("./db.server");
    return db<MissionLog[]>`
      SELECT id, event_level, message, mission_time_offset, logged_at
      FROM mission_logs
      WHERE operator_id = (SELECT id FROM users WHERE supabase_user_id = ${claims.sub} AND is_active LIMIT 1)
      ORDER BY logged_at DESC LIMIT 100
    `;
  });

const missionResultInput = z.object({
  siteName: z.string().trim().min(1).max(100),
  outcome: z.enum(["landed", "crashed"]),
  message: z.string().trim().min(1).max(200),
});

export const recordMyMissionResult = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => missionResultInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<boolean> => {
    const claims = accountClaims(context.claims);
    if (!claims.sub) return false;
    const { db } = await import("./db.server");
    const [account] = await db<{ id: number; is_active: boolean }[]>`
      SELECT id, is_active FROM users WHERE supabase_user_id = ${claims.sub} LIMIT 1
    `;
    if (!account?.is_active) return false;
    const eventLevel = data.outcome === "landed" ? "INFO" : "WARN";
    await db`
      INSERT INTO mission_logs (operator_id, event_level, message, mission_time_offset)
      VALUES (${account.id}, ${eventLevel}, ${`Simulation at ${data.siteName}: ${data.message}`}, 'T+00:00')
    `;
    return true;
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await import("./db.server");
    const claims = accountClaims(context.claims);
    await requireAdmin(db, claims.sub);
    const [counts] = await db<{ users: number; admins: number; active: number; disabled: number }[]>`
      SELECT COUNT(*)::int AS users,
        COUNT(*) FILTER (WHERE is_admin)::int AS admins,
        COUNT(*) FILTER (WHERE is_active)::int AS active,
        COUNT(*) FILTER (WHERE NOT is_active)::int AS disabled
      FROM users
    `;
    const recentUsers = await db<AdminUser[]>`
      SELECT id, username, email, is_admin, is_active, created_at
      FROM users ORDER BY created_at DESC LIMIT 8
    `;
    return { counts: counts ?? { users: 0, admins: 0, active: 0, disabled: 0 }, recentUsers };
  });

const userSearchInput = z.object({ search: z.string().trim().max(100).default(""), role: z.enum(["all", "USER", "ADMIN"]).default("all") });

export const listAdminUsers = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => userSearchInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<AdminUser[]> => {
    const { db } = await import("./db.server");
    const claims = accountClaims(context.claims);
    await requireAdmin(db, claims.sub);
    return db<AdminUser[]>`
      SELECT id, username, email, is_admin, is_active, created_at
      FROM users
      WHERE (${data.search} = '' OR username ILIKE ${`%${data.search}%`} OR email ILIKE ${`%${data.search}%`})
        AND (${data.role} = 'all' OR (${data.role} = 'ADMIN' AND is_admin) OR (${data.role} = 'USER' AND NOT is_admin))
      ORDER BY created_at DESC LIMIT 200
    `;
  });

const updateUserInput = z.object({ id: z.number().int().positive(), isAdmin: z.boolean(), isActive: z.boolean() });

const psrZoneInput = z.object({
  craterName: z.string().trim().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().positive().max(2000),
  iceProbabilityPct: z.number().int().min(0).max(100).nullable(),
  permanentShadow: z.boolean(),
  sourceName: z.string().trim().min(1).max(100),
  sourceUrl: z.string().url().max(1000),
});

export const savePsrZone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => psrZoneInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<void> => {
    const { db } = await import("./db.server");
    const claims = accountClaims(context.claims);
    await requireAdmin(db, claims.sub);
    await db`
      INSERT INTO psr_zones (crater_name, latitude, longitude, radius_km, ice_probability_pct, permanent_shadow, source_name, source_url, updated_at)
      VALUES (${data.craterName}, ${data.latitude}, ${data.longitude}, ${data.radiusKm}, ${data.iceProbabilityPct}, ${data.permanentShadow}, ${data.sourceName}, ${data.sourceUrl}, CURRENT_TIMESTAMP)
      ON CONFLICT (crater_name) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
        radius_km = EXCLUDED.radius_km, ice_probability_pct = EXCLUDED.ice_probability_pct,
        permanent_shadow = EXCLUDED.permanent_shadow, source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url, updated_at = CURRENT_TIMESTAMP
    `;
  });

export const updateAdminUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateUserInput.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<void> => {
    const { db } = await import("./db.server");
    const claims = accountClaims(context.claims);
    await requireAdmin(db, claims.sub);
    await db.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(812734)`;
      const [target] = await tx<{ id: number; is_admin: boolean; is_active: boolean; supabase_user_id: string | null }[]>`
        SELECT id, is_admin, is_active, supabase_user_id FROM users WHERE id = ${data.id} FOR UPDATE
      `;
      if (!target) throw new Response("User not found", { status: 404 });
      if (target.supabase_user_id === claims.sub && (!data.isAdmin || !data.isActive)) {
        throw new Response("You cannot remove your own administrator access or disable your account", { status: 409 });
      }
      const removingActiveAdmin = target.is_admin && target.is_active && (!data.isAdmin || !data.isActive);
      if (removingActiveAdmin) {
        const [activeAdmins] = await tx<{ count: number }[]>`
          SELECT COUNT(*)::int AS count FROM users WHERE is_admin AND is_active AND id <> ${data.id}
        `;
        if ((activeAdmins?.count ?? 0) < 1) throw new Response("The last active administrator cannot be removed", { status: 409 });
      }
      await tx`UPDATE users SET is_admin = ${data.isAdmin}, is_active = ${data.isActive}, updated_at = CURRENT_TIMESTAMP WHERE id = ${data.id}`;
    });
  });
