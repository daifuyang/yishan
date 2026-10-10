$ErrorActionPreference = 'Stop'
$outputDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../src/assets/tabbar'))

# Pinned build-only renderer; no icon package is added to the app runtime.
foreach ($name in @('home', 'home-active', 'apps', 'apps-active', 'user', 'user-active')) {
  $sourceFile = Join-Path $PSScriptRoot "$name.svg"
  $outputFile = Join-Path $outputDirectory "$name.png"
  & npx --yes '@resvg/resvg-js-cli@2.6.2-beta.1' --no-system-font $sourceFile $outputFile
  if ($LASTEXITCODE -ne 0) { throw "Failed to render $name" }
}
