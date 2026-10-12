export interface AdminPluginApi {
  cwd: string
  paths: { absTmpPath: string }
  describe(options: { key: string }): void
  onGenerateFiles(callback: () => void): void
  addTmpGenerateWatcherPaths(callback: () => string[]): void
}
export function createAdminPlugin(options: { apiRoot: string; systemPages?: Readonly<Record<string, string>>; watchPaths?: string[] }): (api: AdminPluginApi) => void
