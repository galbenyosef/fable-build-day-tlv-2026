// Reads the unstructured Hebrew text of building permits with Claude and
// returns structured facts. Runs as a Vercel Node function in production and
// is mounted by vite.config.js as dev middleware, so the browser always calls
// POST /api/extract. The API key stays on the server and is never logged.

const MODEL = "claude-fable-5-1";
const API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM = `You read building-permit records from the Tel Aviv-Yafo municipal GIS (layer "permits").
Each record is a JSON object with these fields:
  id: the permit number, copy it back unchanged.
  addresses: the plot addresses.
  sug_bakasha: the request type. It may carry a height class such as "מעל 29 מ'" or "מעל 13 מ'".
  tochen_bakasha: labelled Hebrew free text describing the request, with line breaks. It lists demolition, basements, the entrance floor, floors above it, roof, homes, sometimes offices or commerce. Labels look like "כמות קומות מגורים: 16", "קומות מעל הכניסה: 10", "יחידות דיור: 66", "כמות יח"ד: 200".
  hakala_melel: relief requested from the plan, when any.
The number of homes from the city's structured record is deliberately withheld; read it from the text.

Return a JSON array only, with one object per input record, in the same order, with exactly these keys:
  id: string, copied from the record.
  floors_above_entrance: integer or null. Residential or office floors above the entrance floor. Never count basements, the entrance floor itself, technical roof floors, or floors that are being demolished.
  housing_units: integer or null. The NEW homes requested. Never the demolished count, never the existing count.
  height_class: string or null. The height class from sug_bakasha, e.g. "מעל 29 מ'", or null when none is stated.
  what: one English sentence, at most 18 words, for a resident: what is being built here.
  evidence: the exact Hebrew fragment of tochen_bakasha that the floors and homes came from, at most 120 characters.
Use null when the text does not say. Do not guess. Answer with the JSON array only: no prose, no code fences.`;

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const ALLOWED = ["id", "addresses", "sug_bakasha", "tochen_bakasha", "hakala_melel"];

function cleanRecord(r) {
  const out = {};
  for (const k of ALLOWED) {
    if (r[k] !== undefined && r[k] !== null) out[k] = String(r[k]);
  }
  out.id = String(r.id ?? "");
  return out;
}

export async function extractPermits(records) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set on the server");
  const body = {
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(records.map(cleanRecord)) }],
  };
  const r = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) {
    throw new Error(`Anthropic ${r.status}: ${j?.error?.message || "request failed"}`);
  }
  if (j.stop_reason === "refusal") throw new Error("The model declined this batch");
  const text = (j.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) {
    throw new Error(`No JSON array in the model reply: ${text.slice(0, 160)}`);
  }
  const items = JSON.parse(text.slice(start, end + 1));
  return { items, usage: j.usage, model: j.model };
}

/** Vercel Node function shape; also called by the Vite dev middleware. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "POST only" }));
    return;
  }
  try {
    const { records } = await readJson(req);
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error("records[] required");
    }
    const out = await extractPermits(records.slice(0, 40));
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: String(e?.message || e) }));
  }
}
