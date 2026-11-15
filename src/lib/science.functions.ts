import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SkySample = { time: string; azimuth: number; elevation: number };
export type SkyAnalysis = {
  site: { latitude: number; longitude: number; altitudeKm: number };
  startTime: string;
  endTime: string;
  sun: SkySample[];
  earth: SkySample[];
  source: string;
  fetchedAt: string;
};

const requestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitudeKm: z.number().min(-10).max(100).default(0),
  startTime: z.string().datetime({ offset: true }),
  durationHours: z.number().int().min(1).max(168),
});

function parseCsv(line: string): string[] {
  return line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)?.map((field) => {
    const value = field.replace(/^,/, "");
    return value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value.trim();
  }) ?? [];
}

function parseHorizonsRows(result: string): SkySample[] {
  const section = result.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!section) throw new Error("JPL Horizons returned no ephemeris rows.");
  const month: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

  return section.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    const fields = parseCsv(line);
    const date = /^(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}:\d{2})/.exec(fields[0] ?? "");
    if (!date || !month[date[2]!]) return [];
    const angles = fields.slice(1).filter((field) => /^-?\d+(?:\.\d+)?$/.test(field)).map(Number);
    if (angles.length < 2) return [];
    return [{
      time: `${date[1]}-${month[date[2]!]}-${date[3]}T${date[4]}:00Z`,
      azimuth: angles.at(-2)!,
      elevation: angles.at(-1)!,
    }];
  });
}

async function fetchTarget(command: string, site: z.infer<typeof requestSchema>, endTime: Date): Promise<SkySample[]> {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${site.longitude},${site.latitude},${site.altitudeKm}'`,
    START_TIME: `'${site.startTime.replace("T", " ").slice(0, 16)}'`,
    STOP_TIME: `'${endTime.toISOString().replace("T", " ").slice(0, 16)}'`,
    STEP_SIZE: "'1 h'",
    TIME_TYPE: "'UT'",
    TIME_DIGITS: "'MINUTES'",
    QUANTITIES: "'4'",
    CSV_FORMAT: "'YES'",
    CAL_TYPE: "'GREGORIAN'",
  });
  const response = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`JPL Horizons request failed (${response.status}).`);
  const payload = await response.json() as { result?: string; error?: string };
  if (payload.error || !payload.result) throw new Error(payload.error ?? "JPL Horizons returned an empty result.");
  return parseHorizonsRows(payload.result);
}

export const analyzeLunarSky = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<SkyAnalysis> => {
    const endTime = new Date(new Date(data.startTime).getTime() + data.durationHours * 60 * 60 * 1000);
    const cacheKeyData = JSON.stringify({ ...data, endTime: endTime.toISOString() });
    const { createHash } = await import("node:crypto");
    const cacheKey = createHash("sha256").update(cacheKeyData).digest("hex");
    const { db } = await import("./db.server");
    const claims = context.claims as { sub?: string };
    if (!claims.sub) throw new Response("Unauthorized", { status: 401 });
    const [account] = await db<{ is_active: boolean }[]>`
      SELECT is_active FROM users WHERE supabase_user_id = ${claims.sub} LIMIT 1
    `;
    if (!account?.is_active) throw new Response("Active account required", { status: 403 });

    try {
      const [cached] = await db<{ payload: SkyAnalysis }[]>`
        SELECT payload FROM ephemeris_cache WHERE cache_key = ${cacheKey} AND expires_at > CURRENT_TIMESTAMP LIMIT 1
      `;
      if (cached) return cached.payload;
    } catch {
      // The ephemeris service remains usable while the optional local cache is unavailable.
    }

    const [sun, earth] = await Promise.all([
      fetchTarget("10", data, endTime),
      fetchTarget("399", data, endTime),
    ]);
    const result: SkyAnalysis = {
      site: { latitude: data.latitude, longitude: data.longitude, altitudeKm: data.altitudeKm },
      startTime: data.startTime,
      endTime: endTime.toISOString(),
      sun,
      earth,
      source: "JPL Horizons, observer ephemeris at coord@301 (geodetic lunar site)",
      fetchedAt: new Date().toISOString(),
    };
    try {
      await db`
        INSERT INTO ephemeris_cache (cache_key, payload, expires_at)
        VALUES (${cacheKey}, ${db.json(result)}, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
        ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at, created_at = CURRENT_TIMESTAMP
      `;
    } catch {
      // A failed cache write does not invalidate a successful Horizons response.
    }
    return result;
  });

const saveAnalysisSchema = z.object({
  siteName: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitudeKm: z.number().min(-10).max(100),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  results: z.unknown(),
});

export const saveLunarAnalysis = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveAnalysisSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<number> => {
    const claims = context.claims as { sub?: string };
    if (!claims.sub) throw new Response("Unauthorized", { status: 401 });
    const { db } = await import("./db.server");
    const [account] = await db<{ id: number }[]>`
      SELECT id FROM users WHERE supabase_user_id = ${claims.sub} AND is_active LIMIT 1
    `;
    if (!account) throw new Response("Active account not found", { status: 403 });
    const [saved] = await db<{ id: number }[]>`
      INSERT INTO site_analyses (user_id, site_name, latitude, longitude, altitude_km, start_time, end_time, results)
      VALUES (${account.id}, ${data.siteName}, ${data.latitude}, ${data.longitude}, ${data.altitudeKm}, ${data.startTime}, ${data.endTime}, ${db.json(JSON.parse(JSON.stringify(data.results)))} )
      RETURNING id
    `;
    return saved!.id;
  });

export type SavedAnalysis = {
  id: number;
  site_name: string;
  latitude: number;
  longitude: number;
  start_time: Date;
  end_time: Date;
  created_at: Date;
};

export const listMySavedAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedAnalysis[]> => {
    const claims = context.claims as { sub?: string };
    if (!claims.sub) return [];
    const { db } = await import("./db.server");
    return db<SavedAnalysis[]>`
      SELECT id, site_name, latitude, longitude, start_time, end_time, created_at
      FROM site_analyses
      WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = ${claims.sub} AND is_active LIMIT 1)
      ORDER BY created_at DESC LIMIT 30
    `;
  });
