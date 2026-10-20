import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = resolve(root, "dist");

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await Promise.all(
  [
    { in: "src/background.ts", out: "background" },
    { in: "src/content/index.ts", out: "content" },
    { in: "src/popup/popup.ts", out: "popup" }
  ].map((entry) =>
    build({
      entryPoints: [resolve(root, entry.in)],
      outfile: resolve(outdir, `${entry.out}.js`),
      bundle: true,
      format: "iife",
      target: "chrome110",
      minify: true,
      legalComments: "none"
    })
  )
);

cpSync(resolve(root, "public"), outdir, { recursive: true });

console.log(`built chrome extension -> ${outdir}`);
