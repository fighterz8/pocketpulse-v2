import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.{test,spec}.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@shared": path.resolve(__dirname, "shared"),
          },
        },
        test: {
          name: "client",
          environment: "jsdom",
          include: ["client/**/*.{test,spec}.{ts,tsx}"],
          setupFiles: ["./client/src/test/setup.ts"],
        },
      },
    ],
  },
});
