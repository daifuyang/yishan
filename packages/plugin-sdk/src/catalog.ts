// TODO(stage-B): wire catalog generation into the SDK.
// Stage B will replace `scripts/profiles/parse.mjs`'s inline catalog stub with
// `generateCatalog(parsedProfile, manifests[])` here. For now this file just
// defines the shape so downstream consumers can type-check against it.

import type { ParsedProfile } from './profile.js'

export interface CatalogPluginEntry {
  id: string
  kind: 'sample' | 'production'
}

export interface PluginCatalog {
  profile: string
  version?: string
  description?: string
  samples: string[]
  plugins: CatalogPluginEntry[]
  targets: string[]
  generatedAt: string
  sourceProfile: string
}

export function generateCatalogStub(profile: ParsedProfile, sourceFile: string): PluginCatalog {
  const samples = profile.samples ?? []
  return {
    profile: profile.profile,
    version: profile.version,
    description: profile.description,
    samples,
    plugins: profile.plugins.map((id) => ({ id, kind: samples.includes(id) ? 'sample' : 'production' })),
    targets: profile.targets,
    generatedAt: new Date().toISOString(),
    sourceProfile: sourceFile,
  }
}