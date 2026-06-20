import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// GitHub Pages serves project sites from /<repo>/.
// Override with VITE_BASE for custom-domain or root deploys.
const base = process.env.VITE_BASE ?? "/axm-capability-claim-test/";

// Stamp the short commit SHA into the build for liveness (footer). Falls back
// to "dev" outside a git checkout.
let buildSha = "dev";
try {
  buildSha = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  /* not a git checkout — leave as 'dev' */
}

export default defineConfig({
  base,
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha),
  },
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
