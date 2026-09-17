import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { AERIAL_YEARS, orthoTiles, findAddress, fetchBuildings } from "./gis.js";

const VENUE = { lng: 34.76314, lat: 32.06279, street: "המרד", number: 25 };

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const form = $("address-form");
const addressInput = $("address");
const goButton = form.querySelector("button");
const yearSlider = $("year");
const yearLabel = $("year-label");
const card = $("card");
const cardBody = $("card-body");

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

map.on("click", "buildings-3d", (e) => {
  const f = e.features && e.features[0];
  if (f) showCard(f.properties);
});
map.on("mouseenter", "buildings-3d", () => {
  map.getCanvas().style.cursor = "pointer";
});
map.on("mouseleave", "buildings-3d", () => {
  map.getCanvas().style.cursor = "";
});

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
    await loadBuildings(place);
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
    await loadBuildings(VENUE);
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
});

map.on("error", (e) => {
  const msg = e?.error?.message;
  if (msg && !/tile/i.test(msg)) setStatus(msg, true);
});
