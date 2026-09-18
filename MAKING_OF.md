# Making of Tel Aviv 2035

Tel Aviv 2035 is a one-page web app that shows a Tel Aviv street in 3D on the city's own aerial photographs, then raises every building that already holds a permit to the floor count that claude-fable-5-1 reads from the permit's Hebrew request text. It was built in the 60-minute contest of the Fable 5.1 Build Day at the Island offices, HaMered 25, Tel Aviv, on Thursday 17 September 2026, and it won the Breakthrough track. This is the story of how the hour went, with the times taken from the git log (Israel time). Commits are named by time and message; the demoed state is the tag `build-day-2026-09-17-winner`.

## The afternoon: twelve ideas, two rounds

The rules were short. Doors 17:00, talks 18:00, build 19:00 to 20:00, two-minute live demos at 20:00, no slides, "show the prompt you used". Judging on four criteria: New Capability, It Works, Keep or Share, Clarity of Demo. The hosts were Natali Shtulman and Tali Despins of the Claude Community; the sponsors Anthropic, Island and EON.

That afternoon, from 16:10, twelve candidate ideas went through two adversarial review rounds. The question in both rounds was the same: how would you solve it today, and do you really need Claude? Five GIS-viewer ideas died in round two for the same reason: Claude would write the code, but nothing in the running app needed a model. The idea that survived needed the model at runtime: a permit's height is not a field in the city's data, it exists only inside labelled Hebrew free text, so something has to read it on every visit.

Primary pick: Skyline 2035, later named Tel Aviv 2035. Alternative: Street Neighbours (Delight track). Network-free pivot if the venue wifi failed: Debt Ledger (Everyday track).

The brief also set the rule we held to: code is written fresh in the hour; briefs, verified endpoints, sample payloads and a warm toolchain are preparation and allowed. It ended with a 60-minute build order and a checkpoint after the first three steps.

## Nineteen minutes of verification

From 19:00 to 19:19, on the venue wifi, we checked every assumption the prompt would depend on. The notes are in `prep/verified.md`.

- The municipal GIS answered in 0.7 s.
- The address query for HaMered 25 returned gush 7003, chelka 13, and a point.
- Building heights are max_height minus min_height (a 20-floor tower: 81.69 minus 18.35, 63 m). The floors field is often 1 even for towers; the year is often null or 0.
- Permits repeat one row per plot, so they must be deduped on permit number, and the housing-unit count is a string.
- Aerial tiles answered for all 13 orthophoto years, 1997 to 2025, at zoom 16.
- The GIS sends no CORS headers, so the browser can never call it directly: a Vite proxy in dev and Vercel rewrites in production, with no server code.
- The Anthropic API answered.
- The npm cache was warm; esbuild's postinstall, blocked by npm 11, was approved.

Each of these became a line in the DATA section of the prompt. The hour had no room to discover them.

## One prompt, three phases, two verifiers

There was one master prompt, kept in the repo as `prep/prompt.md`: an objective, constraints, a DATA section with the verified field rules, seven numbered steps, and a DONE MEANS line ("one verify click shows MATCH on Herzl 116, 200 homes").

It ran as Claude Code "ultracode" multi-agent workflows, one script per phase. Each phase had the same shape.

1. A single builder agent writes the code for that phase's steps and returns a JSON report against a schema: summary, files, commit hash, what it could not verify, and any deviation from the prompt.
2. Two verifier agents run in parallel with different lenses, both under the instruction "you FIX NOTHING; you run checks and report". The functional one checks a clean tree, runs the build, starts the dev server on its own port, curls the proxied GIS and posts two known permits to the extraction endpoint, then reads the source to confirm rules such as "the records sent to the model never include the city's housing count". The visual one drives Chrome, types an address, ticks Show 2035, clicks a tower, presses Verify, screenshots and reads the console. Each returns pass, failures with a fix hint, observations, and a screenshot path.
3. A repair loop of at most two rounds if either verifier fails; each round gets fresh ports. A visual failure worded "not verifiable without browser" is filtered out, so a missing browser can never block the run.

While a phase ran, the orchestrating session prepared the next phase's script. The checkpoint after step 3 was a human one: a screenshot of localhost, a look, and a "go". A fourth script did the deploy: link the Vercel project, pipe the API key into `vercel env add` without printing it, deploy to production, and smoke-test the page, a GIS rewrite, an aerial tile and one model call.

## The hour, minute by minute

| Time | What happened |
|---|---|
| 19:19:45 | Phase one launched: scaffold, MapLibre on the city's 2025 aerial, Hebrew address box, year slider 1997 to 2025, buildings extruded |
| 19:21:05 | Commit: toolchain and prep |
| 19:26:43 | Commit: Skyline app, 3D map on city aerials, address search, year slider, extruded buildings |
| 19:29 | Both verifiers green: 447 buildings at the venue, 667 at Herzl 91, slider swaps to the 1997 aerial, no console errors |
| 19:29 to 19:31 | Vercel project created, tlvnext.com attached, A record set, first production deploy; checkpoint screenshot approved |
| 19:31 | tlvnext.com serves phase one |
| 19:31:52 | Phase two launched: permits read by the model, blue towers, permit card, Verify |
| 19:36:12 | Commit: permits read live by Claude, 2035 towers, permit card, verify against city record |
| 19:41 | Visual verifier green in Chrome: Herzl 91 tower, 9 floors, 152 homes, MATCH |
| 19:41:55 | Commit: orchestrator's own files, after the functional verifier tripped on an unclean tree |
| 19:43:45 | Commit: legend and Today/2035 pill |
| 19:44:07 | Commit: README with the prompt |
| 19:46:41 | Commit: "wow" pass, plan volumes, animated rise, camera sweep |
| 19:49:16 | Commit: fix, plan polygons collapsed by maxAllowableOffset in degrees |
| 19:50 | Verified at the venue: Show 2035 raises the pink Menashiya plan |
| 19:54:47 | Commit: buildings box widened to 800 m |
| 19:59:51 | Commit: 1,100 m box, paging past the 2,000-record cap |
| 20:03:38 | Commit: 1,600 m box, up to 200 permits |
| 20:15:13 | Commit: permits from 10 homes up; last commit before the 20:20 cutoff, tagged `build-day-2026-09-17-winner` |

Ten commits inside the hour, twelve by the cutoff. First agent launch to live site: 11 minutes. The domain had been bought at Namecheap minutes before the deploy.

One builder deviation was logged in phase one: the prompt's 550 m box was read as edge length rather than half-size, because the half-size version hit the server's 2,000-record cap.

Phase two's functional verifier failed on one thing only: an unclean working tree, caused by the orchestrator's own files. The run was stopped and those files were committed at 19:42.

At 19:45 the owner's instruction was: "precision is not the most important thing now, the wow-effect is." The pass that followed added plan volumes from layer 528 in pink (deposited) and pale blue (in force) at indicative heights, permits from one home up, an animated rise and a camera sweep. It was committed at 19:46:41 after 95 seconds of agent time.

## The bug of the night

At 19:47 we checked the wow pass in Chrome. The permits rose, the camera swept, and there was no pink anywhere. The plans were invisible.

The root cause took one query to find. The prompt's DATA section said "use maxAllowableOffset=2" for plans, a simplification tolerance for the polygons. With outSR=4326 the unit of that tolerance is degrees. Two degrees is roughly 220 km, so the server simplified every plan polygon down to nothing.

The fix was one number, 0.00002, deployed at 19:49:16. At 19:50, at the venue address, Show 2035 raised the pink Menashiya plan: 640 homes, deposited, 300 m from the chairs.

## What the model did, measured

| Measure | Result |
|---|---|
| First batch of real permits | 8 permits read in 16.8 s at effort medium |
| Housing units, exact match with the city field | 6 of 8 |
| No count in the permit text | 1 of 8, model returned null |
| Off by one | 1 of 8: 22 read, 23 on record |
| Herzl 116 | 16 floors, 200 homes, MATCH |
| Production at the venue | 103 permits read in 30 s |

The off-by-one became a demo line: "when they do not match, it says so." The city's housing count is never sent to the model, so a MATCH is an independent check, not an echo.

## Five details in the code worth reading

1. **The label rule in the extraction prompt** (`api/extract.js`). The permit text carries labels such as `כמות קומות מגורים: 16` and `קומות מעל הכניסה: 10`. The prompt says these already exclude the entrance floor, so the model must not subtract from them, and must subtract only when the text gives a single total that explicitly includes the entrance, "12 קומות כולל קומת כניסה" meaning 11. The first version without this rule produced off-by-one floors.
2. **An allowlist, not a blocklist.** Only six fields ever reach the model: id, addresses, request type, request text, relief requested and the applicant's reasoning. The city's housing count is not on the list, which is what makes Verify honest.
3. **A deterministic fallback that never overrides the model.** When the model returns null floors for a record whose text carries the label verbatim, a regex reads the number from the label. It fills gaps only; a number the model gave is never replaced, so the same input always yields the same floors.
4. **Plan envelopes are labelled as what they are** (`src/gis.js`). A plan with no cited height gets indicative floors from its housing units (6, 10, 16 or 24 for under 100, 300, 1,000 and above), and the card says "indicative, not a design". A plan wider than 700 m across is drawn as an outline rather than a volume. A cited height replaces the estimate, and a metres figure that the regulations give above sea level (plan 4931: "up to 180 m above sea level") is kept as null, with the 47 floors used instead.
5. **The rise.** Show 2035 multiplies every future layer's extrusion height by a factor eased from 0 to 1 over 1.6 s with a cubic ease-out, while the camera sweeps 35 degrees to a 66-degree pitch. The "Your street in 2035" paragraph is a second, cheaper model call at effort low: exactly three plain sentences, under 80 words, "use only the numbers given".

## The demo

Two minutes, no slides. Opening frame at the venue, HaMered 25, today. Toggle 2035: the pink Menashiya plan rises and the camera sweeps. Hop to a second address. Click a blue tower for its card: floors and homes as read by the model, the Hebrew evidence fragment. Press Verify. Then show the prompt, as the rules asked.

A runbook with six clicks and a fallback for each, and a live log, were kept in a shared doc during the build.

## After the hour

Nothing below is part of the tagged build.

- Data widened to a 2,500 m box (20:20 to 20:30).
- A quality pass (20:46 to 20:59): the relief the developer requested, read from the permit's relief fields; a model-written three-sentence "Tell me about 2035" paragraph per frame; permit age and stage; cited plan heights.
- For the cited heights the model read five in-force plans' scanned regulation PDFs, sent as document blocks so it reads the page images, and returned maximum floors and metres with the page and the exact sentence: 4931, 47 floors, page 16; 4487, 30 floors and 125 m, page 18; 4920, 40 floors and 161 m, page 15; 4963, 25 floors, page 15; 3888 Carmel Market, 6 floors and 27 m, page 24. The quotes are in `src/planHeights.json`.
- A first attempt fed the wrong files, the `_H` allocation tables rather than the regulations. The model returned nulls with a note saying what the document was, instead of inventing numbers.
- A collapsible panel for phones (20:57).
- An API key was exposed in a session transcript by a careless check command. The key was rotated.

Two things did not make it. Plan regulation PDFs are not a runtime feature, because deposited plans have no public files. And the aerial slider stayed a "past" control with 2035 as a toggle, because permits carry no completion dates.

## What we would do differently

- Verify each data rule in the projection the app will use. The one unit error in the prompt cost three minutes of the hour.
- Keep the orchestrator's files out of the tree. That was the functional verifier's only failure.
- Keep check commands that touch secrets out of the transcript. The rotation was avoidable.
- Widen the data box before the hour, not during it. The last four commits before the cutoff were all data widening.
- Ask for nulls explicitly. The model's nulls on the wrong PDFs were the right behaviour; the prompt should say so up front.
- Do not make a visitor pay for model calls. Every page load read permits live, which was the point of the demo and the wrong shape for a public site; the next step is a batch pipeline with cached extractions.

## Credits and links

Built by Benjamin Dysin with Claude Code running Claude Fable 5.1. The same model reads the permit text at runtime.

- Live: https://tlvnext.com
- Demo state: tag `build-day-2026-09-17-winner` (20:15)
- Prompt: `prep/prompt.md` in this repo; preparation notes: `prep/verified.md`; facts and measurements for reuse: `docs/PROJECT_SUMMARY.md`
- Data: Tel Aviv-Yafo public GIS, layers 527 addresses, 513 buildings, 772 permits, 528 plans; orthophoto tiles 1997 to 2025
- Stack: Vite vanilla JavaScript, MapLibre GL, Vercel static build plus Node serverless functions, Vercel rewrites as the CORS-free proxy
