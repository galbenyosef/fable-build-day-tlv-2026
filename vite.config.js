import { defineConfig } from "vite";

const GISN = "https://gisn.tel-aviv.gov.il";

function proxy(target, prefix) {
  return {
    target,
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(prefix, ""),
  };
}

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/gis": proxy(`${GISN}/arcgis/rest/services/IView2/MapServer`, /^\/gis/),
      "/ortho": proxy(`${GISN}/arcgis/rest/services/WM`, /^\/ortho/),
      "/docs": proxy(GISN, /^\/docs/),
    },
  },
});
