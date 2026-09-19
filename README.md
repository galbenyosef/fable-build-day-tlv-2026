# Tel Aviv 2035 (tlvnext.com)

> **Frozen build.** This repository is the state of *Tel Aviv 2035* as demoed at the Fable 5.1 Build Day, Tel Aviv, 17 September 2026, where it won the Breakthrough track. The tag `build-day-2026-09-17-winner` marks the last commit before the 20:20 cutoff; the commits after it only add documentation, the licence and the data notice. The story of the hour is in [MAKING_OF.md](MAKING_OF.md); the product continues at [tlvnext.com](https://tlvnext.com).

> **Code and data.** The code is MIT-licensed. The municipal data the app shows is not in this repository, is not covered by that licence and belongs to the Tel Aviv-Yafo Municipality; anyone who runs or adapts this code must follow the municipality's terms of use. Details in [NOTICE.md](NOTICE.md).

A one-page web app that shows today's Tel Aviv skyline in 3D on the city's own aerial photos, then raises the buildings that already hold a building permit to the floors that Claude read from each permit's Hebrew request text. Type a Hebrew address, see the street as it is today and as it will be in 2035, click any blue tower for its permit card, and press Verify to compare the number of homes the model read against the city's structured record. Claude is load-bearing at runtime, not a build-time helper: the height of every future tower comes from `claude-fable-5-1` reading unstructured permit text (`tochen_bakasha`, `sug_bakasha`, `hakala_melel`) through `api/extract.js` on each visit, and the city's own housing count is deliberately withheld from the model so the Verify button is an honest check rather than an echo.

## Run

```sh
export ANTHROPIC_API_KEY=...   # never committed, never sent to the browser
npm install
npm run dev                    # http://localhost:5173
```

`vite.config.js` proxies the municipal GIS and mounts `api/extract.js` as dev middleware, so the browser always talks to `/gis`, `/ortho`, `/docs` and `/api/extract` on the same origin.

## Deploy

```sh
vercel
```

Set `ANTHROPIC_API_KEY` as a Vercel environment variable (`vercel env add ANTHROPIC_API_KEY`). `vercel.json` carries the same three rewrites as the dev proxy and `api/extract.js` runs as a Node function unchanged.

## Data

Everything comes from the Tel Aviv-Yafo municipal GIS at `https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer` (queried with `f=geojson`, `outSR=4326`), proxied at `/gis`:

- **Layer 527, addresses**: resolves a Hebrew street and house number to a point.
- **Layer 513, buildings**: today's footprints with `ms_komot`, `min_height`, `max_height`, `year`; extruded at `max_height - min_height` (fallback floors × 3.2 m, then 8 m), coloured by year, grey when the year is unknown.
- **Layer 772, permits**: issued building permits with more than 20 homes, deduped on `permission_num`; the Hebrew request text is what Claude reads.
- **Layer 528, plans** (the stretch step, wired at 19:46): statutory plans with status, housing units and regulation documents; drawn as volumes at an indicative height derived from the housing units (pink deposited, blue in force), not as a design.

Aerial photos are the city's orthophoto tiles, proxied at `/ortho` from `https://gisn.tel-aviv.gov.il/arcgis/rest/services/WM`: `/ortho/IView2Ortho{YEAR}WM/MapServer/tile/{z}/{y}/{x}` for the years 1997, 2002, 2005, 2008, 2011, 2014, 2017, 2020, 2021, 2022, 2023, 2024 and 2025 (Web Mercator, 256 px).

Built in one hour at the Fable 5.1 Build Day, Tel Aviv, 17 Sep 2026.

## The prompt

Build "Tel Aviv 2035" (tlvnext.com): a one-page web app that shows today's Tel Aviv skyline in 3D from the city's own public GIS, then raises the buildings that already have a permit to the floors Claude read from each permit's Hebrew request text, with a verify button that checks the model against the city's structured record.

OBJECTIVE. A resident types a Tel Aviv address and sees their street in 3D today and in 2035. Claude is load-bearing at runtime: the heights of future towers come from Claude reading unstructured permit text. Every number is checkable against the municipal record.

CONSTRAINTS. Vite vanilla JS, MapLibre GL, no framework, no TypeScript, no test suite. Hebrew addresses only. Runs on localhost:5173 and deploys to Vercel unchanged. Sixty minutes total, so a complete small thing beats a broken big one. Stop and report at the checkpoint after step 3.

DATA (verified today from this network; details in prep/verified.md).
- GIS base: https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer, f=geojson supported, outSR=4326. No CORS: proxy /gis -> that base, /ortho -> https://gisn.tel-aviv.gov.il/arcgis/rest/services/WM, /docs -> https://gisn.tel-aviv.gov.il, in vite.config.js (dev) and vercel.json rewrites (prod).
- Layer 527 addresses: where=ms_bayit=25 AND t_rechov LIKE '%המרד%'. Hebrew must be percent-encoded. Returns a point.
- Layer 513 buildings: id_binyan, ms_komot, min_height, max_height, year. Height above ground = max_height - min_height (fallback ms_komot*3.2, then 8). year is often null or 0.
- Layer 772 permits: request_num, permission_num, permission_date (epoch ms as string), yechidot_diyur (STRING), sug_bakasha (request type, carries a height class like מעל 29 מ'), tochen_bakasha (labelled Hebrew free text, e.g. כמות קומות מגורים: 16), hakala_melel, building_stage, url_hadmaya (rendering), addresses. One permit repeats per plot polygon: dedupe on permission_num. Filter yechidot_diyur>20, order permission_date DESC.
- Aerials: /ortho/IView2Ortho{YEAR}WM/MapServer/tile/{z}/{y}/{x}, years 1997 2002 2005 2008 2011 2014 2017 2020 2021 2022 2023 2024 2025, Web Mercator, 256 px.
- Layer 528 plans (stretch): taba, shem_taba, t_status (הפקדה deposited, בתוקף in force), megurim_yechidot, url_documents. Use maxAllowableOffset=2. Exclude t_hekef='כלל עירונית'.

STEPS.
1. Scaffold: package.json (vite, maplibre-gl already in node_modules), index.html, src/main.js, src/gis.js, src/style.css, vite.config.js with the three proxies, vercel.json with the same three rewrites, .gitignore. git commit.
2. Map: MapLibre with a raster source on the 2025 aerial, pitch 62, opening on המרד 25 (34.76314, 32.06279). Address box (Hebrew, dir=rtl) queries layer 527 and flies the camera. A year slider 1997..2025 swaps the aerial tiles.
3. Today's buildings: layer 513 in a 550 m box around the point as GeoJSON, fill-extrusion at the computed height, coloured by decade, grey when year unknown. Click shows year, floors, height. CHECKPOINT: start the dev server, screenshot localhost:5173, commit, report.
4. Permits: layer 772 in the same box, deduped. POST them to /api/extract (a Vercel-style handler in api/extract.js, mounted as Vite dev middleware) which calls claude-fable-5-1 with output_config effort medium, no tool_choice, and asks for a JSON array per record: id, floors_above_entrance, housing_units, height_class, what (one English sentence for a resident), evidence (exact Hebrew fragment). The key is process.env.ANTHROPIC_API_KEY. Do not send yechidot_diyur to the model. Extrude each permit at floors*3.2 m in solid blue #3b5bdb behind a "Show 2035" toggle; pale blue until read. Status line shows how many permits Fable read and in how many seconds.
5. Card and verify: clicking a blue tower shows address, permit number and date, floors, homes read by the model, stage, the evidence fragment, and the rendering link. A Verify button compares the model's housing_units with the layer's yechidot_diyur and shows MATCH or MISMATCH with both numbers. Commit.
6. Stretch, only if 4 and 5 work: plans from layer 528 at the point; for plans whose regulation PDF URL is listed in prep/verified.md, fetch the PDF through /docs, send it to the model as a document, ask for maximum height in metres and floors with the page number, extrude at that height in pink #f06595 (deposited) or #748ffc (in force) at 0.6 opacity. Card cites the page.
7. Finish: npm run build passes, README with the prompt, final commit. Never rewrite working files whole to make a small change.

DONE MEANS. Address resolves. Today's buildings render in 3D on the aerial. Permitted buildings rise at their permitted floors with the permit card. One verify click shows MATCH on הרצל 116 (200 homes). Plan towers with a cited page are the stretch.
