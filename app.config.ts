import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  ssr: false,
  server: {
    preset: "vercel",
  },
  vite: {
    server: {
      port: 3000,
    },
    build: {
      target: "esnext",
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
