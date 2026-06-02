$ErrorActionPreference = 'Stop'

& node (Join-Path $PSScriptRoot 'check-generated-files-clean.mjs')
exit $LASTEXITCODE
