import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  ssr: false,
  server: {
    preset: "netlify",
  },
  vite: {
    server: {
      port: 3000,
    },
    optimizeDeps: {
      exclude: ["echarts"],
    },
    build: {
      target: "esnext",
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            if (id.includes("/gsap/")) return "vendor-gsap";
            if (id.includes("/tone/")) return "vendor-tone";
            if (id.includes("/three/")) return "vendor-three";
            if (id.includes("/echarts/") || id.includes("/zrender/")) return "vendor-echarts";
            if (id.includes("/lenis/")) return "vendor-lenis";
          },
        },
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
          silenceDeprecations: ["legacy-js-api", "color-functions", "global-builtin"]
        }
      }
    }
  },
});
