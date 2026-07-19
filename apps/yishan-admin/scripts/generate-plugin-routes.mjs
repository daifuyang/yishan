// Wave 2 — admin plugin-routes generator.
//
// Reads `artifacts/plugin-catalog.json` (the catalog produced by
// `scripts/profiles/parse.mjs --profile <name>`), dynamically imports each
// catalog plugin's `plugin.ts`, and asks the manifest for its admin-route
// declaration via `admin.routes()`.
//
// Old behavior (Wave 1 and earlier): scanned
// `apps/yishan-admin/src/plugins/modules/*.manifest.ts` as static files
// and parsed them with the TypeScript transpileModule. The old files
// (`hello.manifest.ts`, `system.manifest.ts`) are still on disk during Wave 2
// for system routes (system.manifest.ts is Wave 3 scope), so we keep that
// file as a static read but switch `hello` to catalog-driven loading.
//
// See specs/baseline-v2/decisions/ADR-006 + ADR-002.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ADMIN_ROOT = path.resolve(process.cwd());
const REPO_ROOT = path.resolve(ADMIN_ROOT, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'artifacts', 'plugin-catalog.json');
const ROUTES_FILE = path.join(ADMIN_ROOT, 'config/routes.ts');
const OUTPUT_FILE = path.join(ADMIN_ROOT, 'config/generated/plugin-routes.ts');
// Wave 2: keep scanning the legacy admin-side modules directory so
// `system.manifest.ts` (Wave 3 scope) still contributes its routes. The
// hello entry is loaded from the catalog instead.
const LEGACY_MODULES_DIR = path.join(ADMIN_ROOT, 'src/plugins/modules');

const staticRoutePathPattern = /path:\s*['"]([^'"]+)['"]/g;

async function loadManifest(filePath) {
  const source = await fs.readFile(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  });

  const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled.outputText)}`;
  const mod = await import(dataUrl);
  return mod.default;
}

function getStaticRoutePaths(routesSource) {
  const paths = new Set();
  for (const match of routesSource.matchAll(staticRoutePathPattern)) {
    paths.add(match[1]);
  }
  return paths;
}

function normalizeRoute(route) {
  return {
    path: route.path,
    component: route.component,
    access: route.access,
  };
}

function validateManifest(manifest, fileName) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Invalid manifest in ${fileName}: expected object export default.`);
  }
  if (typeof manifest.name !== 'string' || !Array.isArray(manifest.routes)) {
    throw new Error(`Invalid manifest in ${fileName}: missing name or routes.`);
  }
}

async function loadCatalogPluginRoutes() {
  let catalogRaw;
  try {
    catalogRaw = await fs.readFile(CATALOG_PATH, 'utf8');
  } catch (error) {
    console.warn(`[generate-plugin-routes] catalog missing at ${CATALOG_PATH}; skipping catalog plugins.`);
    return [];
  }
  const catalog = JSON.parse(catalogRaw);
  const entries = Array.isArray(catalog.plugins) ? catalog.plugins : [];

  const records = [];
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string') continue;
    const pluginManifestPath = path.join(REPO_ROOT, 'plugins', entry.id, 'plugin.ts');
    let sdkManifest;
    try {
      sdkManifest = await loadManifest(pluginManifestPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[generate-plugin-routes] skipping ${entry.id}: ${message}`);
      continue;
    }
    const adminRoutesFactory = sdkManifest?.admin?.routes;
    if (typeof adminRoutesFactory !== 'function') continue;
    let adminModule;
    try {
      const loaded = await adminRoutesFactory();
      adminModule = loaded?.default ?? loaded;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[generate-plugin-routes] ${entry.id} admin.routes() failed: ${message}`);
      continue;
    }
    if (!adminModule || !Array.isArray(adminModule.routes)) continue;
    for (const route of adminModule.routes) {
      if (!route?.path || !route?.component) continue;
      records.push({
        pluginName: adminModule.name ?? entry.id,
        route: normalizeRoute(route),
      });
    }
  }
  return records;
}

async function loadLegacyModuleRoutes() {
  let files = [];
  try {
    files = (await fs.readdir(LEGACY_MODULES_DIR))
      .filter((name) => name.endsWith('.manifest.ts'))
      .sort();
  } catch {
    return [];
  }
  const records = [];
  for (const fileName of files) {
    const filePath = path.join(LEGACY_MODULES_DIR, fileName);
    try {
      const manifest = await loadManifest(filePath);
      validateManifest(manifest, fileName);
      for (const route of manifest.routes) {
        if (!route?.path || !route?.component) continue;
        records.push({ pluginName: manifest.name, route: normalizeRoute(route) });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[generate-plugin-routes] legacy ${fileName}: ${message}`);
    }
  }
  return records;
}

async function main() {
  const routesSource = await fs.readFile(ROUTES_FILE, 'utf8');
  const staticPaths = getStaticRoutePaths(routesSource);

  const records = [
    ...(await loadCatalogPluginRoutes()),
    ...(await loadLegacyModuleRoutes()),
  ];

  const filtered = records.filter((item) => !staticPaths.has(item.route.path));

  filtered.sort((a, b) => {
    if (a.pluginName === b.pluginName) {
      return a.route.path.localeCompare(b.route.path);
    }
    return a.pluginName.localeCompare(b.pluginName);
  });

  const uniqueByPath = [];
  const seenPaths = new Set();
  for (const item of filtered) {
    if (seenPaths.has(item.route.path)) {
      continue;
    }
    seenPaths.add(item.route.path);
    uniqueByPath.push(item.route);
  }

  const fileContent = `// Auto-generated by scripts/generate-plugin-routes.mjs. Do not edit manually.\ntype PluginRoute = {\n  path: string;\n  component: string;\n  access?: string;\n};\n\nconst pluginRoutes: PluginRoute[] = ${JSON.stringify(uniqueByPath, null, 2)};\n\nexport default pluginRoutes;\n`;

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, fileContent, 'utf8');
  console.log(`Generated ${path.relative(ADMIN_ROOT, OUTPUT_FILE)} with ${uniqueByPath.length} routes.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
