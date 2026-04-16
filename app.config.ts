import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  ssr: false,
  server: {
    preset: "static",
  },
  vite: {
    server: {
      port: 3000,
    },
    build: {
      target: "esnext",
    },
  },
});
