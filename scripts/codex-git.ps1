[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$GitArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'codex-shell-init.ps1')
$null = Initialize-CodexEnvironment

function Resolve-GitSafeDirectory {
  $cursor = (Resolve-Path -LiteralPath (Get-Location).Path).Path

  while ($true) {
    if (Test-Path -LiteralPath (Join-Path $cursor '.git')) {
      return $cursor
    }

    $parent = Split-Path -Parent $cursor
    if (-not $parent -or $parent -eq $cursor) {
      return (Resolve-Path -LiteralPath (Get-Location).Path).Path
    }

    $cursor = $parent
  }
}

$safeDirectory = Resolve-GitSafeDirectory
& git -c "safe.directory=$safeDirectory" @GitArgs
exit $LASTEXITCODE
