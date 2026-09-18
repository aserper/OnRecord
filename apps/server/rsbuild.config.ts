import { readFileSync } from "node:fs";
import { defineConfig } from "@rsbuild/core";

const buildInfo = JSON.parse(readFileSync(new URL("../../build-info.json", import.meta.url), "utf8"));

export default defineConfig({
  source: { define: { __BUILD_INFO__: JSON.stringify(buildInfo) } },
  output: { distPath: "./build", target: "node" },
});
