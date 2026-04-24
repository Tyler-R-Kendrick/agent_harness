[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'codex-shell-init.ps1')
$environmentState = Initialize-CodexEnvironment

$gitWrapper = Join-Path $PSScriptRoot 'codex-git.ps1'
$ghWrapper = Join-Path $PSScriptRoot 'codex-gh.ps1'

$gitTopLevel = & $gitWrapper rev-parse --show-toplevel 2>&1
$gitExitCode = $LASTEXITCODE

$ghStatus = & $ghWrapper auth status 2>&1
$ghExitCode = $LASTEXITCODE

[pscustomobject]@{
  CODEX_HOME = $environmentState.CODEX_HOME
  GH_CONFIG_DIR = $environmentState.GH_CONFIG_DIR
  GitHubCliConfigSource = $environmentState.GitHubCliConfigSource
  GitSafeDirectoryOk = $gitExitCode -eq 0
  GitTopLevel = if ($gitExitCode -eq 0) { ($gitTopLevel | Select-Object -First 1) } else { $null }
  GitHubAuthOk = $ghExitCode -eq 0
  GitHubAuthSummary = ($ghStatus | Select-Object -First 5) -join [Environment]::NewLine
  UnexpectedRootAutomationsPath = Test-Path -LiteralPath 'C:\automations'
}
