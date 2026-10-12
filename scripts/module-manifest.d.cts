export interface InstalledModule { readonly id: string; readonly entry: string; readonly local: boolean }
export function readInstalledModules(apiRoot: string): readonly InstalledModule[]
export function findProductApis(repositoryRoot: string): readonly string[]
