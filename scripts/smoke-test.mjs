import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = ["index.html", "styles.css", "app.js", "favicon.svg", ".nojekyll"];
const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) failures.push(`Missing ${file}`);
}

const html = readFileSync(resolve(root, "index.html"), "utf8");
const script = readFileSync(resolve(root, "app.js"), "utf8");

for (const selector of ["id=\"app\"", "data-action=\"login\"", "data-action=\"reset-demo\"", "data-variant-label"]) {
  if (!html.includes(selector)) failures.push(`index.html lacks ${selector}`);
}

for (const phase of ["voting", "upcoming", "live", "soldout"]) {
  if (!html.includes(`data-phase=\"${phase}\"`)) failures.push(`Missing ${phase} preview control`);
}

for (const variant of ["renderVariantA", "renderVariantB", "renderVariantC"]) {
  if (!script.includes(`function ${variant}`)) failures.push(`Missing ${variant}`);
}

for (const match of script.matchAll(/image: "(\.\/assets\/products\/[^"]+)"/g)) {
  if (!existsSync(resolve(root, match[1]))) failures.push(`Missing product asset ${match[1]}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Static smoke checks passed: files, four phases, three variants, and product assets are present.");
