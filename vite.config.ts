import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites from /<repo>/.
// Override with VITE_BASE for custom-domain or root deploys.
const base = process.env.VITE_BASE ?? "/axm-capability-claim-test/";

export default defineConfig({
  base,
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
