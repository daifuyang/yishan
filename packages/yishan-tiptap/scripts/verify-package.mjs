import { access, readdir, stat } from "node:fs/promises";

const distDirectory = new URL("../dist/", import.meta.url);
const requiredFiles = [
  "dist/index.cjs",
  "dist/index.esm.js",
  "dist/index.d.ts",
  "dist/index.css",
  "README.md",
  "LICENSE",
];

for (const file of requiredFiles) {
  await access(new URL(`../${file}`, import.meta.url));
}

const distFiles = await readdir(distDirectory);
const sourceMaps = distFiles.filter((file) => file.endsWith(".map"));
if (sourceMaps.length > 0) {
  throw new Error(`Release package must not contain source maps: ${sourceMaps.join(", ")}`);
}

const packageSize = await Promise.all(
  distFiles.map(async (file) => (await stat(new URL(`../dist/${file}`, import.meta.url))).size),
);
const totalBytes = packageSize.reduce((total, size) => total + size, 0);

console.log(`Verified yishan-tiptap package files (${totalBytes} bytes in dist).`);
