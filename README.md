# JARSIG Orbital

JARSIG is a lunar mission exploration and planning application.

## Development

Install Bun and PostgreSQL, copy `.env.example` to `.env`, and configure Supabase plus the PostgreSQL connection before starting the app.

```powershell
bun install
psql $env:DATABASE_URL -f backend/db/schema.sql
bun run db:seed
bun run dev
```

In PowerShell, set `$env:DATABASE_URL` from the connection string in `.env` before running these commands.

## Database and default accounts

`backend/db/schema.sql` is safe to run again. It keeps the original JARSIG tables and adds account linking, saved analyses, mission updates, and ephemeris caching. Copy `.env.example` to `.env` and fill in the database URL, Supabase project URL, publishable key, and service role key. Keep `.env` private.

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_USER_EMAIL`, and `DEMO_USER_PASSWORD`, then run `bun run db:seed`. It creates missing Supabase Auth accounts and links them to PostgreSQL; Supabase stores the password hashes. The administrator is required to change the seed password after the first sign-in. Existing accounts keep their current password when the seed is rerun.

New sign-ups are linked to the `users` table on sign-in. Administrators manage roles and active status from `/admin`; the backend checks permissions and prevents disabling or demoting the last active administrator. Saved scientific analyses belong to their creator. The SQL never drops tables or rows.

Email confirmation and Google sign-in are managed by Supabase Auth. To enable Google, configure the Google provider credentials in Supabase Authentication settings, add Supabase's callback URL to the Google OAuth client, and allow the app's `/auth` URL in Supabase's redirect URL settings.

## Scientific pages

- `/science` calls the JPL Horizons observer API for the Sun and Earth at a lunar surface coordinate (`coord@301`, geodetic east longitude/latitude/altitude). It plots azimuth/elevation, estimates sampled sunlight and Earth-visibility windows, and lets signed-in users save and compare site/date analyses. Terrain masking and solar panel output are not modeled.
- `/map` displays NASA/JPL Moon Trek's LRO WAC global mosaic through its documented WMTS tiles. Pan, zoom, click to select coordinates, load representative south-pole landing points from a published study, then send a point to JPL Horizons. Full Moon Trek and LROC QuickMap remain available for their detailed polar, elevation, and image layers.
- The landing-area screen embeds NASA Moon Trek and lists representative south-pole Artemis points with direct links to analyze them. Simulator outcomes remain separate from the scientific ephemeris products.
- `/missions` refreshes the official NASA launch schedule page and Artemis RSS feed every 15 minutes while open. Schedule dates can move; entries link back to NASA.

The Canadian Space Agency is included as a background reference at [Moon exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/); it is not used as an API.

Use `.env.example` as the environment variable template. There is no NASA API key requirement for JPL Horizons or the NASA feeds. The service role key is needed only by the account seed script and must never be exposed to browser code.
