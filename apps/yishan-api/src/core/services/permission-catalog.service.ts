/**
 * Permission Catalog Service — Core only.
 *
 * Returns the static Core permission definitions. The plugin/manifest
 * permission merge path that previously lived here was removed together
 * with `plugins/`, `plugin-platform/`, and `plugin-sdk/`. New permissions
 * added by modules should be declared in `core/permissions/generated/`
 * (the single source of truth consumed at boot).
 *
 * Behaviour preserved for callers:
 *   - `getGlobalCatalog()` returns the frozen Core catalog list.
 *   - `ActivePermissionItem`, `PermissionConflict`, `PermissionConflictError`,
 *     `CatalogNotInitializedError` keep their public shape.
 *   - `init()` is a no-op (kept so the call sites in app.ts boot don't need
 *     to change); the catalog is available immediately.
 */

import { corePermissionDefinitions } from '../permissions/generated/core-permissions.js';
import { BusinessError } from '../../exceptions/business-error.js';
import { ValidationErrorCode } from '../../constants/business-codes/validation.js';

export interface ActivePermissionItem {
  code: string;
  label: string;
  description?: string;
  group: string;
  source: 'core' | string;
}

export interface PermissionConflict {
  code: string;
  sources: Array<{ source: 'core' | string; label: string }>;
}

export class PermissionConflictError extends BusinessError {
  constructor(conflict: PermissionConflict) {
    super(
      ValidationErrorCode.INVALID_STATE,
      `permission code conflict: "${conflict.code}" declared by ${conflict.sources.map((s) => s.source).join(', ')}`,
    );
    this.name = 'PermissionConflictError';
  }
}

export class CatalogNotInitializedError extends BusinessError {
  constructor() {
    super(
      ValidationErrorCode.INVALID_STATE,
      'Permission catalog has not been initialized before authorization started',
    );
    this.name = 'CatalogNotInitializedError';
  }
}

const coreCatalog: ReadonlyArray<ActivePermissionItem> = Object.freeze(
  corePermissionDefinitions.map((def) =>
    Object.freeze({
      code: def.code,
      label: def.label,
      description: def.description,
      group: def.group,
      source: 'core' as const,
    }),
  ),
);

export class PermissionCatalogService {
  isInitialized(): boolean {
    return true;
  }

  async init(): Promise<void> {
    // No-op: the Core catalog is static.
  }

  async getActiveCodes(): Promise<Set<string>> {
    return this.getCodeSet();
  }

  async getDeclaredCodes(): Promise<Set<string>> {
    return this.getCodeSet();
  }

  async getActiveCatalog(): Promise<ReadonlyArray<ActivePermissionItem>> {
    return this.getCatalog();
  }

  getCatalog(): ReadonlyArray<ActivePermissionItem> {
    return coreCatalog;
  }

  getCodeSet(): Set<string> {
    return new Set(coreCatalog.map((p) => p.code));
  }

  getVersionKey(): string {
    return `core:${coreCatalog.length}`;
  }
}

let cachedService: PermissionCatalogService | null = null;
export function getGlobalCatalog(): PermissionCatalogService {
  if (!cachedService) cachedService = new PermissionCatalogService();
  return cachedService;
}

/**
 * Legacy boot-time initializer kept as a no-op so callers still compile.
 * The plugin-state / manifest merge path it used to drive was removed
 * together with the plugin pipeline; the Core catalog is static.
 */
export async function initGlobalCatalog(
  _pluginStateReader?: () => Promise<unknown>,
  _manifestReader?: unknown,
): Promise<void> {
  // No-op: see file header.
}