// TODO(stage-B): wire profile parsing into the SDK.
// For now this is a stub re-export — `scripts/profiles/parse.mjs` is the
// canonical implementation. Once stage B unifies the parsing surface, this
// module will expose `parseProfile()`, `loadProfile(name)`, and shared
// types consumed by both the CLI script and the catalog generator.

export type ProfileKind = 'sample' | 'production'

export interface ParsedProfile {
  profile: string
  version: string
  description?: string
  samples: string[]
  plugins: string[]
  targets: string[]
}