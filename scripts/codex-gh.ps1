[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$GhArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'codex-shell-init.ps1')
$null = Initialize-CodexEnvironment

& gh @GhArgs
exit $LASTEXITCODE
