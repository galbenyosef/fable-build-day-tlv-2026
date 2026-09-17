import { defineConfig, loadEnv } from "vite";

const GISN = "https://gisn.tel-aviv.gov.il";

function proxy(target, prefix) {
  return {
    target,
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(prefix, ""),
  };
}

/** Dev-only mount of the Vercel function at /api/extract. */
function apiPlugin() {
  return {
    name: "tlvnext-api",
    configureServer(server) {
      server.middlewares.use("/api/extract", async (req, res) => {
        try {
          const mod = await server.ssrLoadModule("/api/extract.js");
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: String(e?.message || e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Let a .env.local hold the key for local dev without exposing it to the client
  // (only VITE_-prefixed vars reach the browser bundle). Never logged.
  const env = loadEnv(mode, process.cwd(), "");
  if (!process.env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  }
  return {
    plugins: [apiPlugin()],
    server: {
      port: 5173,
      proxy: {
        "/gis": proxy(`${GISN}/arcgis/rest/services/IView2/MapServer`, /^\/gis/),
        "/ortho": proxy(`${GISN}/arcgis/rest/services/WM`, /^\/ortho/),
        "/docs": proxy(GISN, /^\/docs/),
      },
    },
  };
});
