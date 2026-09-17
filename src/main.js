import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import {
  AERIAL_YEARS,
  orthoTiles,
  findAddress,
  fetchBuildings,
  fetchPermits,
  permitHeight,
} from "./gis.js";

const VENUE = { lng: 34.76314, lat: 32.06279, street: "המרד", number: 25 };
const BATCH_SIZE = 8;
const CACHE_PREFIX = "tlv2035:permit:";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const form = $("address-form");
const addressInput = $("address");
const goButton = form.querySelector("button");
const yearSlider = $("year");
const yearLabel = $("year-label");
const card = $("card");
const cardBody = $("card-body");
const show2035 = $("show-2035");
const rereadLink = $("reread");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

// ---------------------------------------------------------------- map

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      ortho: {
        type: "raster",
        tiles: orthoTiles(2025),
        tileSize: 256,
        maxzoom: 22,
        attribution: "עיריית תל אביב-יפו · GIS",
      },
      buildings: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      permits: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#0b0d12" } },
      { id: "ortho", type: "raster", source: "ortho", paint: { "raster-fade-duration": 150 } },
      {
        id: "buildings-3d",
        type: "fill-extrusion",
        source: "buildings",
        paint: {
          "fill-extrusion-height": ["get", "h"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-color": [
            "case",
            ["<=", ["get", "year"], 0],
            "#8d9096",
            [
              "interpolate",
              ["linear"],
              ["get", "year"],
              1930, "#f3e2b6",
              1960, "#e9dcc4",
              1990, "#d9d9d6",
              2025, "#c9ccd2",
            ],
          ],
        },
      },
      {
        id: "permits",
        type: "fill-extrusion",
        source: "permits",
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-height": ["get", "h"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.95,
          "fill-extrusion-color": ["case", ["to-boolean", ["get", "read"]], "#3b5bdb", "#8ea0e8"],
        },
      },
    ],
  },
  center: [VENUE.lng, VENUE.lat],
  zoom: 16.3,
  pitch: 62,
  bearing: -20,
  maxPitch: 80,
  attributionControl: { compact: true },
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

// ---------------------------------------------------------------- year slider

yearSlider.max = String(AERIAL_YEARS.length - 1);
yearSlider.value = String(AERIAL_YEARS.length - 1);

function applyYear() {
  const year = AERIAL_YEARS[Number(yearSlider.value)];
  yearLabel.value = String(year);
  const src = map.getSource("ortho");
  if (src) src.setTiles(orthoTiles(year));
}
yearSlider.addEventListener("input", applyYear);

// ---------------------------------------------------------------- buildings

async function loadBuildings(place) {
  const fc = await fetchBuildings(place.lng, place.lat);
  map.getSource("buildings").setData(fc);
  setStatus(`${fc.features.length} buildings · ${place.street} ${place.number}`);
}

function showCard(props) {
  const rows = [
    ["Year", props.year > 0 ? props.year : "unknown"],
    ["Floors", props.ms_komot > 0 ? props.ms_komot : "unknown"],
    ["Height", `${Math.round(props.h)} m`],
    ["Type", props.t_sug_mivne || "unknown"],
  ];
  card.classList.remove("permit");
  cardBody.innerHTML = `<dl>${rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(String(v))}</dd>`)
    .join("")}</dl>`;
  card.hidden = false;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

$("card-close").addEventListener("click", () => {
  card.hidden = true;
});

// ---------------------------------------------------------------- permits

// The current box's permit features, by permission_num, holding the live
// (non-stringified) properties merged from the model.
const permitById = new Map();
let permitsFC = { type: "FeatureCollection", features: [] };
let loadGeneration = 0;

function cacheKey(id) {
  return `${CACHE_PREFIX}${id}`;
}

function readCache(id) {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(id, item) {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify(item));
  } catch {
    // storage full or blocked: the live read still works
  }
}

function clearCacheFor(features) {
  for (const f of features) {
    try {
      localStorage.removeItem(cacheKey(f.properties.id));
    } catch {
      // ignore
    }
  }
}

function toInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Merge one model answer onto the matching feature. */
function applyItem(item) {
  const f = permitById.get(String(item?.id ?? ""));
  if (!f) return false;
  const p = f.properties;
  p.floors_above_entrance = toInt(item.floors_above_entrance);
  p.housing_units = toInt(item.housing_units);
  p.height_class = item.height_class ? String(item.height_class) : null;
  p.what = item.what ? String(item.what) : "";
  p.evidence = item.evidence ? String(item.evidence) : "";
  p.read = true;
  p.h = permitHeight(p);
  return true;
}

function pushPermits() {
  const src = map.getSource("permits");
  if (src) src.setData(permitsFC);
}

function recordFor(f) {
  const p = f.properties;
  // yechidot_diyur is deliberately withheld: the city's count is only used to verify.
  return {
    id: p.id,
    addresses: p.addresses ?? "",
    sug_bakasha: p.sug_bakasha ?? "",
    tochen_bakasha: p.tochen_bakasha ?? "",
    hakala_melel: p.hakala_melel ?? "",
  };
}

async function extractBatch(features) {
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records: features.map(recordFor) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || `extract responded ${res.status}`);
  return Array.isArray(json.items) ? json.items : [];
}

/**
 * Read the permits currently loaded with the model, in parallel batches.
 * Cached answers are used unless `force` is set.
 */
async function readPermits(place, generation, force = false) {
  const all = permitsFC.features;
  const total = all.length;
  if (total === 0) {
    setStatus(`No permits with more than 20 homes near ${place.street} ${place.number}`);
    return;
  }

  let fromCache = 0;
  const pending = [];
  for (const f of all) {
    const cached = force ? null : readCache(f.properties.id);
    if (cached && applyItem({ ...cached, id: f.properties.id })) fromCache += 1;
    else pending.push(f);
  }
  pushPermits();

  if (pending.length === 0) {
    setStatus(`Fable read ${total} of ${total} permits · from cache`);
    return;
  }

  setStatus(`Fable is reading ${pending.length} permits…`);
  const started = performance.now();
  let done = fromCache;
  let failed = 0;

  const batches = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    batches.push(pending.slice(i, i + BATCH_SIZE));
  }

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const items = await extractBatch(batch);
        if (generation !== loadGeneration) return;
        for (const item of items) {
          if (applyItem(item)) {
            writeCache(String(item.id), item);
            done += 1;
          }
        }
        pushPermits();
        setStatus(`Fable is reading ${pending.length} permits… ${done} of ${total} done`);
      } catch (err) {
        failed += batch.length;
        console.warn("extract failed", err);
      }
    }),
  );
  if (generation !== loadGeneration) return;

  const secs = ((performance.now() - started) / 1000).toFixed(1);
  const cacheNote = fromCache > 0 ? ` (${fromCache} from cache)` : "";
  if (failed > 0 && done === fromCache) {
    setStatus(`Fable could not read the permits: check the server log`, true);
  } else {
    setStatus(`Fable read ${done} of ${total} permits in ${secs} s${cacheNote}`);
  }
}

async function loadPermits(place, generation) {
  const fc = await fetchPermits(place.lng, place.lat);
  if (generation !== loadGeneration) return;
  permitsFC = fc;
  permitById.clear();
  for (const f of fc.features) permitById.set(f.properties.id, f);
  pushPermits();
  show2035.disabled = false;
  show2035.parentElement.classList.add("ready");
  rereadLink.hidden = fc.features.length === 0;
  await readPermits(place, generation);
}

const modePill = $("mode");

show2035.addEventListener("change", () => {
  map.setLayoutProperty("permits", "visibility", show2035.checked ? "visible" : "none");
  modePill.textContent = show2035.checked ? "2035" : "Today";
  modePill.classList.toggle("future", show2035.checked);
});

let currentPlace = VENUE;
rereadLink.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!permitsFC.features.length) return;
  clearCacheFor(permitsFC.features);
  for (const f of permitsFC.features) {
    f.properties.read = false;
    f.properties.h = permitHeight({ sug_bakasha: f.properties.sug_bakasha });
  }
  pushPermits();
  const generation = ++loadGeneration;
  try {
    await readPermits(currentPlace, generation, true);
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
});

// ---------------------------------------------------------------- permit card

function formatDate(epochMs) {
  const n = Number(epochMs);
  if (!Number.isFinite(n) || n <= 0) return "unknown";
  return new Date(n).toISOString().slice(0, 10);
}

function showPermitCard(f) {
  const p = f.properties;
  const title = p.addresses || `Permit ${p.id}`;
  const floors =
    p.floors_above_entrance !== null && p.floors_above_entrance !== undefined
      ? `${p.floors_above_entrance} above entrance`
      : p.read
        ? "not stated"
        : "reading…";
  const homes =
    p.housing_units !== null && p.housing_units !== undefined
      ? String(p.housing_units)
      : p.read
        ? "not stated"
        : "reading…";
  const rows = [
    ["Permit", `${p.id} · ${formatDate(p.permission_date)}`],
    ["Floors", `${floors}${p.height_class ? ` · ${p.height_class}` : ""}`],
    ["Homes", `${homes} (as read by Fable)`],
    ["Stage", p.building_stage || "unknown"],
  ];
  const what = p.what ? `<p class="what">${escapeHtml(p.what)}</p>` : "";
  const evidence = p.evidence
    ? `<p class="evidence" dir="rtl" lang="he">${escapeHtml(p.evidence)}</p>`
    : "";
  const rendering = p.url_hadmaya
    ? `<a class="card-link" href="${escapeHtml(String(p.url_hadmaya))}" target="_blank" rel="noopener">Developer's rendering ↗</a>`
    : "";
  card.classList.add("permit");
  cardBody.innerHTML = `
    <h2 dir="rtl" lang="he">${escapeHtml(title)}</h2>
    ${what}
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(String(v))}</dd>`).join("")}</dl>
    ${evidence}
    ${rendering}
    <button id="verify" class="verify" type="button" ${p.read ? "" : "disabled"}>Verify against the city record</button>
    <div id="verify-result" class="badge" hidden></div>`;
  card.hidden = false;

  $("verify").addEventListener("click", () => {
    const city = Number(p.yechidot_diyur);
    const model = p.housing_units;
    const badge = $("verify-result");
    badge.hidden = false;
    if (!Number.isFinite(city)) {
      badge.className = "badge mismatch";
      badge.textContent = "City record has no housing count";
    } else if (model === city) {
      badge.className = "badge match";
      badge.textContent = `MATCH · city record says ${city} homes`;
    } else {
      badge.className = "badge mismatch";
      badge.textContent = `MISMATCH · model ${model ?? "null"}, city record ${city}`;
    }
  });
}

// ---------------------------------------------------------------- clicks

// One handler for both layers: a permit tower wins over the building under it.
map.on("click", (e) => {
  const hits = map.queryRenderedFeatures(e.point, { layers: ["permits", "buildings-3d"] });
  if (!hits.length) return;
  const permitHit = hits.find((h) => h.layer.id === "permits");
  if (permitHit) {
    const f = permitById.get(String(permitHit.properties.id));
    if (f) {
      showPermitCard(f);
      return;
    }
  }
  const building = hits.find((h) => h.layer.id === "buildings-3d");
  if (building) showCard(building.properties);
});
for (const layer of ["buildings-3d", "permits"]) {
  map.on("mouseenter", layer, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", layer, () => {
    map.getCanvas().style.cursor = "";
  });
}

// ---------------------------------------------------------------- address

async function goTo(text) {
  goButton.disabled = true;
  setStatus("Looking up address…");
  try {
    const place = await findAddress(text);
    map.flyTo({
      center: [place.lng, place.lat],
      zoom: 16.3,
      pitch: 62,
      bearing: -20,
      duration: 2200,
      essential: true,
    });
    setStatus(`Loading buildings around ${place.street} ${place.number}…`);
    const generation = ++loadGeneration;
    currentPlace = place;
    await loadBuildings(place);
    await loadPermits(place, generation);
  } catch (err) {
    setStatus(err.message || String(err), true);
  } finally {
    goButton.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  goTo(addressInput.value);
});

map.on("load", async () => {
  applyYear();
  try {
    setStatus("Loading buildings…");
    const generation = ++loadGeneration;
    await loadBuildings(VENUE);
    await loadPermits(VENUE, generation);
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
});

map.on("error", (e) => {
  const msg = e?.error?.message;
  if (msg && !/tile/i.test(msg)) setStatus(msg, true);
});
