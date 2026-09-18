# Tel Aviv 2035 (tlvnext.com) — project summary

Source material for CV and LinkedIn writing, drawn only from the repository, git history, the prep email and the author's session notes. Times are Israel time, 17 September 2026. The narrative version is `MAKING_OF.md` at the repository root.

## Abstract

Tel Aviv 2035 is a one-page web app built solo by Benjamin Dysin in the 60-minute contest of the Fable 5.1 Build Day, Tel Aviv, 17 September 2026. It renders today's skyline in 3D on the city's own aerial photographs, then raises every building that already holds a permit to the floor count claude-fable-5-1 reads at runtime from the permit's unstructured Hebrew request text; a Verify button checks the model's reading against the city's structured housing-unit field. It won the Breakthrough track. All data is public Tel Aviv-Yafo GIS; the stack is Vite vanilla JavaScript, MapLibre GL and Vercel.

## Outcome

- Award: winner, Breakthrough track; other tracks Delight, Everyday. Criteria: New Capability, It Works, Keep or Share, Clarity of Demo. Rules: 60 minutes to build (19:00–20:00), two-minute live demo, no slides, prompt shown.
- Event: Fable 5.1 Build Day, Island offices, HaMered 25, Tel Aviv; hosts Natali Shtulman and Tali Despins for the Claude Community; sponsors Anthropic, Island, EON.
- Live: https://tlvnext.com. Domain bought during the build hour and pointed at Vercel; phase one live at 19:31.
- Git: 12 commits before the 20:20 demo cutoff (10 inside the hour), 20 by 21:00. Demo state: tag `build-day-2026-09-17-winner` (20:15).

## What it does

1. A Hebrew address resolves through layer 527 and the camera flies there.
2. Today's buildings in a 2.5 km box are extruded at recorded height (max_height minus min_height), coloured by year; a slider swaps the aerial across 13 orthophoto years, 1997–2025.
3. "Show 2035" animates permitted towers (solid blue) rising at floors × 3.2 m, plus statutory plan envelopes (pink deposited, blue in force) at indicative or cited heights.
4. A tower's card shows address, permit number and date, floors, homes as read by the model, stage, the Hebrew evidence fragment, relief requested and the rendering link.
5. Verify compares the model's housing_units with the layer's yechidot_diyur and shows MATCH or MISMATCH with both numbers.
6. "Your street in 2035": three model-written sentences from the permits and plans on screen.

## Why it was hard, and what the new model enabled

- Permit height is not a field. It exists only inside tochen_bakasha, labelled Hebrew free text whose template varies per permit. The model must return floors above entrance and new homes, not demolished or existing ones, with an exact evidence fragment.
- Plan heights live only in scanned regulation PDFs with no text layer; the city viewer shows polygons. Five in-force plans were read for maximum height and floors with page citations.
- Verification is designed in: the city's housing count is withheld from the model and used only by Verify, so a match is an independent check. A regex fallback fills floors from the label when the model returns null, never overriding a model value.

## Architecture and data

Vite 7 vanilla JS (no framework, TypeScript or tests), MapLibre GL 5, Vercel static build plus two Node serverless functions (`api/extract.js`, `api/summary.js`) that hold the API key. The GIS sends no CORS headers, so three paths are proxied by Vite in dev and by Vercel rewrites in production. About 1,290 lines of JavaScript in four files.

| Source (IView2 MapServer) | Used for | Key fields |
|---|---|---|
| Layer 527 addresses | address to point | t_rechov, ms_bayit, ms_gush, ms_chelka |
| Layer 513 buildings | today's 3D footprints | ms_komot, min_height, max_height, year |
| Layer 772 permits | future towers, verify | tochen_bakasha, sug_bakasha, hakala_melel, yechidot_diyur, url_hadmaya |
| Layer 528 plans | plan envelopes | taba, t_status, megurim_yechidot, url_documents |
| WM orthophoto tiles | aerial base | 13 years, Web Mercator, 256 px |

claude-fable-5-1 is called through the Messages API at effort medium for extraction (per-record JSON: floors, homes, height class, description, evidence, relief) and low for the summary, in parallel batches of 8 permits (server cap 40), with answers cached per permit in localStorage.

## Method: how it was built in one hour

Preparation, allowed by the rules, was the same afternoon: an email (16:10) took twelve candidate ideas through two adversarial rounds and picked Skyline 2035; `prep/verified.md` recorded endpoints, field semantics and sample payloads checked from the venue network at about 19:00. No app code existed before 19:00.

The hour ran from one master prompt (`prep/prompt.md`: objective, constraints, verified data, seven steps, a checkpoint after step 3, a "done means" line) run as Claude Code "ultracode" multi-agent workflows:

| Time | Step |
|---|---|
| 19:19:45 | Phase one launched: scaffold, 3D map on the aerial, address search, buildings |
| 19:29 | Phase one green, two verifier agents (commits 19:21, 19:26) |
| 19:31 | MVP checkpoint with the author; site live at tlvnext.com |
| 19:31:52 | Phase two launched: permits read at runtime, towers, card, verify |
| 19:43 | Phase two green (permits commit 19:36); legend and README by 19:44 |
| 19:46 | "Wow" pass: plan volumes, animated rise, camera sweep |
| 19:49, 19:55 | Final deploys |
| 20:15 | Last commit before the 20:20 cutoff, tagged |

After the hour: data widening (box 800 m to 2,500 m, up to 400 permits per address), a quality pass (relief text, model-written 2035 paragraph, cited plan heights from five regulation PDFs) and a collapsible mobile panel. Last commit 21:00.

## Measured results

| Measure | Result |
|---|---|
| Extraction latency | 16.8 s for a batch of 8 permits at medium effort |
| Production at the venue | 103 permits read in 30 s |
| Verify, first probe | 6 of 8 exact matches with the city's housing count |
| Verify, later probe (large permits) | 4 of 6 exact; one off-by-one; one null where the text carried no count |
| Plan PDFs read with a page cite | 5 of 5: 4931 (47 floors, p.16), 4487 (30 floors, 125 m, p.18), 4920 (40 floors, 161 m, p.15), 4963 (25 floors, p.15), 3888 (6 floors, 27 m, p.24) |
| First agent launch to live site | 11 minutes (19:19:45 to 19:31) |

## Highlights worth telling

The lines below are the ones a reader remembers; each is sourced from the git log, the workflow scripts or the code.

- 17 September 2026, 19:19:45 to 19:31: first agent launch to a live site at tlvnext.com in 11 minutes. The domain was bought minutes earlier, the Vercel project created, the A record set and phase one deployed while the author looked at the checkpoint screenshot.
- The same afternoon, twelve candidate ideas went through two adversarial review rounds on one question, "how would you solve it today, and do you really need Claude?"; five GIS-viewer ideas were dropped in round two for not needing Claude at runtime. The winner is the one where the model is load-bearing: a permit's height exists only in Hebrew free text.
- Nineteen minutes of verification from the venue wifi (19:00 to 19:19) before any code: GIS reachable in 0.7 s, HaMered 25 resolving to gush 7003 chelka 13, heights as max_height minus min_height, permits deduped on permit number, all 13 aerial years answering at zoom 16, the Anthropic API answering, npm cache warm. Every finding became a line in the prompt's DATA section.
- One master prompt (seven numbered steps, a DATA section of verified field rules, a DONE MEANS line) run as multi-agent workflows: one builder agent per phase returning a schema-checked JSON report (files, commit, unverified, deviations); two verifier agents in parallel with different lenses and a standing order to fix nothing (functional: clean tree, build, curl the proxied endpoints, post two known permits to the model, read the source for the rules; visual: drive Chrome, screenshot, click through Verify, read the console); a repair loop capped at two rounds with fresh ports per round.
- Phase one green at 19:29, under ten minutes after launch: 447 buildings at the venue, 667 at Herzl 91, the slider swapping to the 1997 aerial, no console errors.
- Phase two (launched 19:31:52, green 19:41): permits read by claude-fable-5-1 through a serverless endpoint in parallel batches of 8; the visual verifier ticked Show 2035, clicked the central tower at Herzl 91 and saw 9 floors, 152 homes, green MATCH.
- The "wow" pass (plan volumes from layer 528, animated rise, camera sweep) was committed at 19:46:41 after 95 seconds of agent time, on the instruction "precision is not the most important thing now, the wow-effect is".
- The bug of the night, found in one query and fixed with one number: maxAllowableOffset=2 with outSR=4326 is two degrees, roughly 220 km, which collapsed every plan polygon; set to 0.00002, deployed 19:49, and at 19:50 the pink Menashiya plan (640 homes, deposited) rose 300 m from the audience.
- Measured on the night: 8 real permits read in 16.8 s at effort medium; 6 of 8 housing-unit readings matched the city record exactly, one null where the text carried no count, one off by one (22 read, 23 on record), which became the demo line "when they do not match, it says so". In production at the venue, 103 permits in 30 s.
- Honesty is built into the data flow, not bolted on: the model receives an allowlist of six permit fields and the city's housing count is not one of them, so MATCH is an independent check; a deterministic regex fills floors from the label only when the model returned null and never overrides a model value; plan envelopes without a cited height are labelled "indicative, not a design" and plans wider than 700 m are drawn as outlines rather than volumes.
- Ten commits inside the hour, twelve by the 20:20 cutoff; the last four before the cutoff were all data widening (800 m, 1,100 m with paging past the 2,000-record cap, 1,600 m and 200 permits, permits from 10 homes up).
- After the hour, the model read five in-force plans' scanned regulation PDFs (sent as document blocks, read as page images) and returned maximum floors and metres with page numbers and the exact sentence (4931: 47 floors, p.16; 4920: 40 floors, 161 m, p.15); a first attempt fed the wrong files (allocation tables) and the model returned nulls with a note saying what the document was, rather than inventing numbers. Where the regulations give height above sea level (4931: 180 m), the metres are kept as null and the floors used.
- Won the Breakthrough track on a two-minute live demo with no slides: venue frame, toggle 2035, second address, click a tower, Verify, prompt shown.

## Skills demonstrated

- GIS / ArcGIS REST: envelope queries, geojson output, paging, dedupe
- MapLibre GL 3D: raster aerials, fill-extrusion, data-driven colour, animated rise
- LLM extraction with verification: structured JSON from Hebrew free text, withheld ground truth, scanned-PDF reading with citations
- Prompt design: one master prompt with constraints, verified data, steps, checkpoint, done criteria
- Vercel deployment and DNS: rewrites as CORS proxy, serverless functions, secrets, domain pointed mid-build
- Agent orchestration: phased multi-agent workflows, schema-checked agent reports, verifier agents that fix nothing, a human checkpoint
- Rapid product scoping: twelve candidates to one brief

## Limitations and honest caveats

- Plan heights are indicative (derived from housing units) except for the five cited plans; plans wider than 700 m are drawn as outlines.
- Verify checks housing units only; floors have no structured field. Match rates come from small probes (n=8, n=6), not a systematic evaluation.
- Every visitor triggers model calls (cache is per browser), so the site is not yet suited to public scale; the follow-up is an offline batch pipeline with cached extractions.
- An API key exposed during the evening was rotated afterwards.
- Hebrew addresses only; no automated tests; the buildings layer often lacks a year or carries a wrong floor count.
- The README still calls layer 528 "not wired"; that predates the 19:46 commit.

## Links

- Live: https://tlvnext.com
- Public repository (frozen build): https://github.com/benjddd/fable-build-day-tlv-2026 (tag `build-day-2026-09-17-winner`)
- Making-of: `MAKING_OF.md`; prompt: `prep/prompt.md`; preparation notes: `prep/verified.md`; plan citations: `src/planHeights.json`
- Data: https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer
