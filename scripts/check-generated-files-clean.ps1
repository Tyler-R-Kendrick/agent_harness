$ErrorActionPreference = 'Stop'

$trackedFiles = & (Join-Path $PSScriptRoot 'codex-git.ps1') ls-files
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$trackedFiles -join [Environment]::NewLine | & node (Join-Path $PSScriptRoot 'check-generated-files-clean.mjs') --stdin-lines
exit $LASTEXITCODE
