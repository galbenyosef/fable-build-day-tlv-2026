# Verified before the build hour (2026-09-17, ~19:00, venue network)

Allowed preparation per the brief: verified endpoints, sample payloads, warm toolchain. No app code.

## Toolchain
- Node v24.19.0, npm 11.17.0, git 2.55, Claude Code 2.1.268.
- `node_modules` warm with vite ^7 and maplibre-gl ^5 (`package.json` in repo).
- npm 11 blocks esbuild's postinstall: after `npm install` run `npm approve-scripts esbuild && npm rebuild esbuild`, or `vite` fails to start.
- Vercel CLI not installed. `npx vercel` will fetch it on first use.

## GIS (gisn.tel-aviv.gov.il, IView2 MapServer) — reachable from the venue, ~0.7 s
- Address 527: `where=ms_bayit=25 AND t_rechov LIKE '%המרד%'` → 1 feature, gush 7003 chelka 13, lng 34.76314 lat 32.06279. Hebrew must be percent-encoded UTF-8 in the URL.
- Buildings 513: fields id_binyan, ms_komot, min_height, max_height, dsm_max, year. Height above ground = `max_height - min_height` (20-floor tower: 81.69 − 18.35 = 63 m). `dsm_max` is a close alternative. `ms_komot` is often 1 even for towers; `year` is often null or 0. Venue box 150 m has 34 buildings.
- Permits 772: `yechidot_diyur` is a STRING ("200"). `permission_date` is epoch ms as a string. The layer repeats one permit per plot polygon: dedupe on `permission_num`. `tochen_bakasha` is labelled Hebrew text with `\r\n` breaks, e.g. `כמות קומות מגורים: 16`. `sug_bakasha` carries the height class, e.g. `בניה חדשה בניין רב קומות (מעל 29 מ')`. `url_hadmaya` links to the rendering archive.
- Aerial tiles: `/arcgis/rest/services/WM/IView2Ortho2025WM/MapServer/tile/{z}/{y}/{x}` in Web Mercator (wkid 102100), 24 LODs, 256 px. Tile 16/26599/39093 (venue) returns image/png. Works as a MapLibre raster source with `{z}/{y}/{x}`.
- No CORS on gisn. Vite dev proxy works for `/gis`, `/ortho`, `/docs`. For production, Vercel `rewrites` with an external destination proxy the same paths with no server code.

## Anthropic
- Model ID `claude-fable-5-1`. Effort via `output_config: {effort}`. No `tool_choice: any`. Adaptive thinking always on.
- The server-side call needs `ANTHROPIC_API_KEY`. Not set in this shell and no `.env` in the repo yet. Vite's `loadEnv` reads `.env`; Vercel needs it as a project env var.

## Draft code from before the freeze
A working draft (map on the 2025 aerial, GIS client, permit extraction endpoint) was written outside the repo before the hour and kept as reference only; the hour's code was written fresh.
