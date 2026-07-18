/**
 * Permission Catalog Service
 *
 * 统一管理 Core 静态权限定义与活动插件权限目录。
 * 插件启用、禁用、卸载、同步后必须失效缓存。
 * 多实例通过持久化版本号和失效事件保证最终一致。
 *
 * 新方案约束（2026-07-14）：
 * - 插件 manifest 仅接受结构化权限对象，不兼容 string[]。
 * - available-scopes、PAT 创建校验、computeEffectivePerms 都以活动权限目录为准。
 * - 插件禁用后对应 PAT scope 立即失效；重新启用后自动恢复。
 * - Catalog 以插件持久化状态为准，每次授权前检查数据库 versionKey。
 * - Core 与插件权限严格单一归属，重复 code 直接失败。
 * - 不保留 feature flag、灰度或旧语义回退。
 * - 未初始化时抛明确错误，不静默降级为纯 Core 目录。
 * - 数据库读取失败时 fail closed，拒绝授权。
 */

import {
  PERMISSION_DEFINITIONS,
} from '../../constants/permission-codes.js';
import { PluginManifest } from '../../core/plugin-platform/types.js';
import { BusinessError } from '../../exceptions/business-error.js';
import { ValidationErrorCode } from '../../constants/business-codes/validation.js';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Manifest 读取器，返回已加载并通过校验的 manifest。
 */
export interface ManifestReader {
  /** 返回已经加载并通过校验的 manifest。 */
  listManifests(): PluginManifest[];
}

// ============================================================================
// Types
// ============================================================================

/**
 * 活动权限目录项，包含 code、label、description、group、source。
 * source 标识权限来源：'core' | pluginId
 */
export interface ActivePermissionItem {
  code: string;
  label: string;
  description?: string;
  group: string;
  source: 'core' | string; // string = pluginId
}

/**
 * 权限冲突信息
 */
export interface PermissionConflict {
  code: string;
  sources: Array<{ source: 'core' | string; label: string }>;
}

/**
 * 缓存版本 key 生成器。
 * 使用插件状态快照（pluginId + enabled + updatedAt）生成稳定指纹，
 * 确保多实例在插件状态变化后能最终刷新目录。
 */
function generateVersionKey(snapshots: { pluginId: string; enabled: boolean; updatedAt: string | null }[]): string {
  const sorted = [...snapshots].sort((a, b) => a.pluginId.localeCompare(b.pluginId));
  return sorted
    .map(item => `${item.pluginId}:${item.enabled ? 1 : 0}:${item.updatedAt ?? ''}`)
    .join('|');
}

// ============================================================================
// Errors
// ============================================================================

export class PermissionConflictError extends BusinessError {
  constructor(conflicts: PermissionConflict[]) {
    const details = conflicts.map(c =>
      `权限码 '${c.code}' 重复声明于: ${c.sources.map(s => s.source).join(', ')}`
    ).join('; ');
    super(
      ValidationErrorCode.INVALID_PARAMETER,
      `权限定义冲突: ${details}`,
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

// ============================================================================
// Service
// ============================================================================

export class PermissionCatalogService {
  private cachedCodes: Set<string> | null = null;
  private cachedCatalog: ActivePermissionItem[] | null = null;
  private cachedVersionKey: string | null = null;
  private _initialized: boolean = false;

  constructor(
    private readonly pluginStateReader?: () => Promise<{ pluginId: string; enabled: boolean; updatedAt: string | null }[]>,
    private readonly manifestReader?: ManifestReader,
  ) {}

  /**
   * 检查是否已初始化。
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * 确保服务已初始化。
   */
  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new CatalogNotInitializedError();
    }
  }

  /**
   * 初始化并构建活动权限目录。
   *
   * 严格单一归属约束：
   * - Core 权限只能在 PERMISSION_DEFINITIONS 定义
   * - 插件权限只能在对应插件 manifest 定义
   * - 发现重复 code 立即抛 PermissionConflictError
   *
   * 持久化状态同步机制：
   * - 首次调用读取 snapshot 并构建目录
   * - 后续每次授权前通过 refreshIfVersionChanged() 检查版本变化
   * - 多实例通过统一的数据库状态保证最终一致
   */
  async init(): Promise<void> {
    if (!this.pluginStateReader || !this.manifestReader) {
      throw new Error('PermissionCatalogService requires pluginStateReader and manifestReader to be injected');
    }

    const snapshots = await this.readSnapshotsOrFail();
    await this.rebuildFromSnapshots(snapshots);
    this._initialized = true;
  }

  /**
   * 读取插件状态快照，失败时拒绝授权（fail closed）。
   */
  private async readSnapshotsOrFail(): Promise<{ pluginId: string; enabled: boolean; updatedAt: string | null }[]> {
    if (!this.pluginStateReader) {
      throw new CatalogNotInitializedError();
    }
    try {
      return await this.pluginStateReader();
    } catch (error) {
      throw new BusinessError(
        ValidationErrorCode.INVALID_STATE,
        '无法读取插件权限目录状态，已拒绝本次授权',
      );
    }
  }

  /**
   * 根据快照重建权限目录。
   */
  private async rebuildFromSnapshots(
    snapshots: { pluginId: string; enabled: boolean; updatedAt: string | null }[],
  ): Promise<void> {
    const newVersionKey = generateVersionKey(snapshots);

    const items: ActivePermissionItem[] = [];
    const codeToSources = new Map<string, { source: 'core' | string; label: string }[]>();

    // 1. Core 静态权限
    for (const def of PERMISSION_DEFINITIONS) {
      const item: ActivePermissionItem = {
        code: def.code,
        label: def.label,
        description: def.description,
        group: def.group,
        source: 'core',
      };
      items.push(item);
      codeToSources.set(def.code, [{ source: 'core', label: def.label }]);
    }

    // 2. 活动插件权限（从数据库读取 enabled 状态）
    const manifests = this.manifestReader!.listManifests();

    for (const manifest of manifests) {
      // 仅当插件在快照中为 enabled 时添加其权限
      const state = snapshots.find(s => s.pluginId === manifest.pluginId);
      if (!state?.enabled) continue;

      for (const perm of manifest.permissions) {
        const item: ActivePermissionItem = {
          code: perm.code,
          label: perm.label,
          description: perm.description,
          group: perm.group ?? 'plugin',
          source: manifest.pluginId,
        };
        items.push(item);

        // 收集来源用于冲突检测
        const existing = codeToSources.get(perm.code);
        if (existing) {
          existing.push({ source: manifest.pluginId, label: perm.label });
        } else {
          codeToSources.set(perm.code, [{ source: manifest.pluginId, label: perm.label }]);
        }
      }
    }

    // 3. 检测重复 code 冲突
    const conflicts: PermissionConflict[] = [];
    for (const [code, sources] of codeToSources) {
      if (sources.length > 1) {
        conflicts.push({ code, sources });
      }
    }

    // 发现冲突立即抛错误
    if (conflicts.length > 0) {
      throw new PermissionConflictError(conflicts);
    }

    // 4. 更新缓存和版本 key
    this.cachedCatalog = items;
    this.cachedCodes = new Set(items.map(item => item.code));
    this.cachedVersionKey = newVersionKey;
  }

  /**
   * 检查数据库版本是否变化，变化则重建目录。
   * 每次授权前调用，确保多实例最终一致。
   */
  private async refreshIfVersionChanged(): Promise<void> {
    this.ensureInitialized();

    const snapshots = await this.readSnapshotsOrFail();
    const versionKey = generateVersionKey(snapshots);

    if (versionKey === this.cachedVersionKey) {
      return; // 版本未变，使用缓存
    }

    // 版本变化，重建目录
    await this.rebuildFromSnapshots(snapshots);
  }

  /**
   * 获取当前活动权限目录。
   * 每次调用前检查数据库版本，变化则重建。
   */
  async getActiveCatalog(): Promise<ActivePermissionItem[]> {
    await this.refreshIfVersionChanged();
    return this.cachedCatalog!;
  }

  /**
   * 获取所有活动权限 code 集合（用于快速校验）。
   * 每次调用前检查数据库版本，变化则重建。
   */
  async getActiveCodes(): Promise<Set<string>> {
    await this.refreshIfVersionChanged();
    return this.cachedCodes!;
  }

  /**
   * 校验某个 code 是否在活动权限目录中。
   */
  async hasActiveCode(code: string): Promise<boolean> {
    const codes = await this.getActiveCodes();
    return codes.has(code);
  }

  /**
   * 获取某 group 下的所有活动权限。
   */
  async getByGroup(group: string): Promise<ActivePermissionItem[]> {
    const catalog = await this.getActiveCatalog();
    return catalog.filter(item => item.group === group);
  }

  /**
   * 获取所有不同的 group 列表。
   */
  async getGroups(): Promise<string[]> {
    const catalog = await this.getActiveCatalog();
    return [...new Set(catalog.map(item => item.group))];
  }

  /**
   * 获取当前缓存版本 key。
   */
  getVersion(): string {
    return this.cachedVersionKey ?? '';
  }

  /**
   * 失效缓存。插件启用、禁用、卸载、同步后调用。
   * 让本实例无需等到下一次版本比较即可使用最新目录。
   */
  invalidate(): void {
    this.cachedCatalog = null;
    this.cachedCodes = null;
    this.cachedVersionKey = null;
    this._initialized = false;
  }
}

// ============================================================================
// Global singleton instance
// ============================================================================

let globalCatalogService: PermissionCatalogService | null = null;

/**
 * 获取全局权限目录服务实例。
 * 未初始化时抛出 CatalogNotInitializedError。
 */
export function getGlobalCatalog(): PermissionCatalogService {
  if (!globalCatalogService) {
    throw new CatalogNotInitializedError();
  }
  return globalCatalogService;
}

/**
 * 初始化全局权限目录服务。
 * 应在插件系统初始化后、应用启动时调用。
 *
 * @param pluginStateReader - 返回插件状态快照数组的函数（而非对象）
 * @param manifestReader - manifest 读取器
 */
export async function initGlobalCatalog(
  pluginStateReader: () => Promise<{ pluginId: string; enabled: boolean; updatedAt: string | null }[]>,
  manifestReader: ManifestReader,
): Promise<PermissionCatalogService> {
  const catalog = new PermissionCatalogService(pluginStateReader, manifestReader);
  await catalog.init();
  globalCatalogService = catalog;
  return catalog;
}

/**
 * 失效全局权限目录缓存。
 * 插件生命周期变化时调用。
 * 失效后必须重新调用 initGlobalCatalog 才能使用。
 */
export async function invalidateGlobalCatalog(): Promise<void> {
  if (globalCatalogService) {
    globalCatalogService.invalidate();
  }
}
