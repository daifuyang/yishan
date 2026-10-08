// P0 test-only preload shim (NOT product code).
// tsc `module: commonjs` compiles onboard-modules.ts's `import(pathToFileURL(...).href)`
// into `require('file:///...')`, which Node never resolves. This shim converts file:// specifiers
// to paths so the remaining onboard logic (module migrate -> sys_module_migration sync -> seed)
// can be observed. Used only via NODE_OPTIONS=--require in isolated temp-DB scenarios.
const Module = require('module');
const { fileURLToPath } = require('url');
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (typeof request === 'string' && request.startsWith('file://')) request = fileURLToPath(request);
  return orig.call(this, request, ...rest);
};
