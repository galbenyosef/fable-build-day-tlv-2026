// Query module for the Tel Aviv municipal GIS (IView2 MapServer).
// All requests go through the /gis proxy (vite.config.js in dev, vercel.json in prod),
// so this module never talks to gisn.tel-aviv.gov.il directly.

const GIS_BASE = "/gis";
const ORTHO_BASE = "/ortho";

export const LAYERS = {
  addresses: 527,
  buildings: 513,
  permits: 772,
};

export const AERIAL_YEARS = [
  1997, 2002, 2005, 2008, 2011, 2014, 2017, 2020, 2021, 2022, 2023, 2024, 2025,
];

/** Tile URL template for the city's aerial photo of a given year. */
export function orthoTiles(year) {
  return [`${ORTHO_BASE}/IView2Ortho${year}WM/MapServer/tile/{z}/{y}/{x}`];
}

/**
 * Generic ArcGIS layer query returning GeoJSON.
 * `params` are merged over sensible defaults; Hebrew values are percent-encoded
 * by URLSearchParams.
 */
export async function queryLayer(layerId, params = {}) {
  const search = new URLSearchParams({
    f: "geojson",
    outSR: "4326",
    outFields: "*",
    returnGeometry: "true",
    where: "1=1",
    ...params,
  });
  const url = `${GIS_BASE}/${layerId}/query?${search.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GIS ${layerId} responded ${res.status}`);
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message || `GIS ${layerId} error`);
  }
  return json;
}

/**
 * Split a Hebrew address like "המרד 25" or "הרצל 91א" into street and house number.
 * Returns null when no number is present.
 */
export function parseAddress(text) {
  const trimmed = (text || "").trim().replace(/\s+/g, " ");
  const m = trimmed.match(/^(.*?)\s*(\d+)\s*[א-ת]?$/) || trimmed.match(/^(\d+)\s+(.*)$/);
  if (!m) return null;
  let street, number;
  if (/^\d/.test(m[1])) {
    number = Number(m[1]);
    street = m[2];
  } else {
    street = m[1];
    number = Number(m[2]);
  }
  street = street.replace(/^רחוב\s+/, "").replace(/['"]/g, "").trim();
  if (!street || !Number.isFinite(number)) return null;
  return { street, number };
}

/**
 * Look up an address on layer 527. Resolves to
 * { lng, lat, street, number, gush, chelka } or throws when nothing matches.
 */
export async function findAddress(text) {
  const parsed = parseAddress(text);
  if (!parsed) throw new Error("Write a street and a house number, e.g. המרד 25");
  const { street, number } = parsed;
  const safeStreet = street.replace(/'/g, "''");
  const json = await queryLayer(LAYERS.addresses, {
    where: `ms_bayit=${number} AND t_rechov LIKE '%${safeStreet}%'`,
    outFields: "t_rechov,ms_bayit,ms_gush,ms_chelka",
    resultRecordCount: "5",
  });
  const feature = (json.features || []).find((f) => f.geometry?.type === "Point");
  if (!feature) throw new Error(`Address not found: ${street} ${number}`);
  const [lng, lat] = feature.geometry.coordinates;
  const p = feature.properties || {};
  return {
    lng,
    lat,
    street: p.t_rechov || street,
    number: p.ms_bayit ?? number,
    gush: p.ms_gush ?? null,
    chelka: p.ms_chelka ?? null,
  };
}

/** Bounding box [minLng, minLat, maxLng, maxLat] of `metres` around a point. */
export function boxAround(lng, lat, metres) {
  const dLat = metres / 111320;
  const dLng = metres / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

/**
 * Height above ground of a layer-513 building, in metres.
 * max_height - min_height when plausible, else floors * 3.2, else 8.
 */
export function buildingHeight(p) {
  const diff = Number(p.max_height) - Number(p.min_height);
  if (Number.isFinite(diff) && diff >= 2 && diff <= 400) return diff;
  const floors = Number(p.ms_komot);
  if (Number.isFinite(floors) && floors > 0) return floors * 3.2;
  return 8;
}

/**
 * Fetch today's buildings (layer 513) inside a square box of `boxSize` metres
 * (edge length) around the point. A 550 m box returns a few hundred polygons,
 * safely under the server's 2000-record cap.
 * Each feature gets numeric `h` (height) and `year` properties.
 */
export async function fetchBuildings(lng, lat, boxSize = 550) {
  const halfSize = boxSize / 2;
  const bbox = boxAround(lng, lat, halfSize);
  const json = await queryLayer(LAYERS.buildings, {
    geometry: bbox.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "id_binyan,ms_komot,min_height,max_height,dsm_max,year,t_sug_mivne",
    resultRecordCount: "2000",
  });
  const features = (json.features || []).map((f) => {
    const p = f.properties || {};
    const year = Number(p.year) || 0;
    return {
      ...f,
      properties: { ...p, h: buildingHeight(p), year },
    };
  });
  return { type: "FeatureCollection", features };
}
