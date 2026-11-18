// Bundles the React app into frontend/dist with esbuild (no heavy toolchain needed).
import { build, context } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const watch = process.argv.includes("--watch");
const outdir = "dist";

rmSync(outdir, { recursive: true, force: true });
mkdirSync(`${outdir}/assets`, { recursive: true });
cpSync("index.html", `${outdir}/index.html`);
cpSync("public", outdir, { recursive: true });

const options = {
  entryPoints: { main: "src/main.tsx" },
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  format: "esm",
  target: ["es2020"],
  outdir: `${outdir}/assets`,
  jsx: "automatic",
  loader: { ".tsx": "tsx", ".ts": "ts" },
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
  nodePaths: process.env.NODE_PATH ? process.env.NODE_PATH.split(":") : [],
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes…");
} else {
  await build(options);
}
