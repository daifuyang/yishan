#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const checks = [
  'scripts/arch/check-routes.mjs',
  'scripts/arch/check-manifest.mjs',
  'scripts/arch/check-boundaries.mjs',
  'scripts/arch/check-admin-types.mjs',
];

for (const file of checks) {
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
