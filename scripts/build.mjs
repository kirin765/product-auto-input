import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = resolve(root, "dist");
const firefoxDir = resolve(root, "dist-firefox");

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
rmSync(firefoxDir, { recursive: true, force: true });
mkdirSync(firefoxDir, { recursive: true });

await Promise.all(
  [
    { in: "src/background.ts", out: "background" },
    { in: "src/content/index.ts", out: "content" },
    { in: "src/popup/popup.ts", out: "popup" }
  ].flatMap((entry) => [outdir, firefoxDir].map((output) =>
    build({
      stdin: {
        contents: `import "./src/shared/webext.ts"; import "./${entry.in}";`,
        resolveDir: root,
        loader: "ts"
      },
      outfile: resolve(output, `${entry.out}.js`),
      bundle: true,
      format: "iife",
      target: output === firefoxDir ? "firefox140" : "chrome110",
      minify: true,
      legalComments: "none"
    })
  ))
);

cpSync(resolve(root, "public"), outdir, { recursive: true });
cpSync(resolve(root, "public"), firefoxDir, { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.json"), "utf8"));
delete manifest.minimum_chrome_version;
manifest.background = { scripts: ["background.js"] };
manifest.browser_specific_settings = {
  gecko: {
    id: "product-auto-input@onnurimun.com",
    strict_min_version: "140.0",
    data_collection_permissions: { required: ["none"] }
  }
};
writeFileSync(resolve(firefoxDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
for (const output of [outdir, firefoxDir]) cpSync(resolve(root, "LICENSE"), resolve(output, "LICENSE"));

console.log(`built Chrome and Firefox extensions -> ${outdir}, ${firefoxDir}`);
