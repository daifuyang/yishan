export interface InstalledModule { id: string; entry: string; local: boolean }
export function readInstalledModules(apiRoot: string): InstalledModule[]
export function findProductApis(repositoryRoot: string): string[]
