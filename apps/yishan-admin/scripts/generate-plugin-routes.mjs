// Wave 3 — admin plugin-routes generator.
//
// Two sources of admin routes are merged into `config/generated/plugin-routes.ts`:
//   1. Plugin routes — read from `artifacts/plugin-catalog.json` (produced by
//      `scripts/profiles/parse.mjs --profile <name>`). For each catalog entry
//      we dynamic-import `plugins/<id>/plugin.ts`, ask the manifest for its
//      `admin.routes()` factory, and read the resolved module's `routes`.
//   2. Core routes — read from `apps/yishan-admin/src/core/routes.ts`. The
//      five system/* admin pages (plugins/storage/attachments/login-log) are
//      Core-owned and are no longer declared as a fake plugin manifest.
//
// See specs/baseline-v2/decisions/ADR-002-plugin-sdk.md step 6 + ADR-006.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ADMIN_ROOT = path.resolve(process.cwd());
const REPO_ROOT = path.resolve(ADMIN_ROOT, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'artifacts', 'plugin-catalog.json');
const ROUTES_FILE = path.join(ADMIN_ROOT, 'config/routes.ts');
const OUTPUT_FILE = path.join(ADMIN_ROOT, 'config/generated/plugin-routes.ts');
// Wave 3: Core admin routes are declared in src/core/routes.ts (ADR-002
// step 6). The legacy src/plugins/modules/*.manifest.ts directory is gone.
const CORE_ROUTES_FILE = path.join(ADMIN_ROOT, 'src/core/routes.ts');

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

async function loadCoreRoutes() {
  try {
    const manifest = await loadManifest(CORE_ROUTES_FILE);
    validateManifest(manifest, 'core/routes.ts');
    const records = [];
    for (const route of manifest.routes) {
      if (!route?.path || !route?.component) continue;
      records.push({ pluginName: '__core__', route: normalizeRoute(route) });
    }
    return records;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[generate-plugin-routes] core/routes.ts: ${message}`);
    return [];
  }
}

async function main() {
  const routesSource = await fs.readFile(ROUTES_FILE, 'utf8');
  const staticPaths = getStaticRoutePaths(routesSource);

  const records = [
    ...(await loadCatalogPluginRoutes()),
    ...(await loadCoreRoutes()),
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
