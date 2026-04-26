Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-CodexHomeCandidates {
  $candidates = [System.Collections.Generic.List[string]]::new()

  if ($env:CODEX_HOME) {
    $candidates.Add($env:CODEX_HOME)
  }

  if ($env:USERPROFILE) {
    $candidates.Add((Join-Path $env:USERPROFILE '.codex'))
  }

  if ($HOME) {
    $candidates.Add((Join-Path $HOME '.codex'))
  }

  $cursor = $PSScriptRoot
  while ($cursor) {
    $candidate = Join-Path $cursor '.codex'
    if (Test-Path -LiteralPath $candidate -PathType Container) {
      $candidates.Add($candidate)
    }

    $parent = Split-Path -Parent $cursor
    if (-not $parent -or $parent -eq $cursor) {
      break
    }

    $cursor = $parent
  }

  if (Test-Path -LiteralPath 'C:\Users' -PathType Container) {
    Get-ChildItem -LiteralPath 'C:\Users' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $candidate = Join-Path $_.FullName '.codex'
      if (Test-Path -LiteralPath $candidate -PathType Container) {
        $candidates.Add($candidate)
      }
    }
  }

  return $candidates | Where-Object { $_ } | Select-Object -Unique
}

function Resolve-CodexHome {
  foreach ($candidate in Get-CodexHomeCandidates) {
    if (Test-Path -LiteralPath $candidate -PathType Container) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw 'Unable to resolve CODEX_HOME. Set CODEX_HOME explicitly or run inside a checkout under a .codex worktree.'
}

function Sync-GitHubCliConfig {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDirectory,
    [Parameter(Mandatory = $true)]
    [string]$DestinationDirectory
  )

  foreach ($fileName in @('config.yml', 'hosts.yml')) {
    $sourcePath = Join-Path $SourceDirectory $fileName
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      continue
    }

    $destinationPath = Join-Path $DestinationDirectory $fileName
    $shouldCopy = -not (Test-Path -LiteralPath $destinationPath -PathType Leaf)

    if (-not $shouldCopy) {
      $sourceInfo = Get-Item -LiteralPath $sourcePath
      $destinationInfo = Get-Item -LiteralPath $destinationPath
      $shouldCopy = $sourceInfo.LastWriteTimeUtc -gt $destinationInfo.LastWriteTimeUtc
    }

    if ($shouldCopy) {
      Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    }
  }
}

function Initialize-CodexEnvironment {
  $codexHome = Resolve-CodexHome
  $env:CODEX_HOME = $codexHome

  $ghConfigDirectory = if ($env:GH_CONFIG_DIR) {
    $env:GH_CONFIG_DIR
  } else {
    Join-Path $codexHome 'gh-cli'
  }

  New-Item -ItemType Directory -Force -Path $ghConfigDirectory | Out-Null

  $appDataGhDirectory = $null
  if ($env:APPDATA) {
    $candidate = Join-Path $env:APPDATA 'GitHub CLI'
    if (Test-Path -LiteralPath $candidate -PathType Container) {
      $appDataGhDirectory = $candidate
      Sync-GitHubCliConfig -SourceDirectory $candidate -DestinationDirectory $ghConfigDirectory
    }
  }

  $env:GH_CONFIG_DIR = $ghConfigDirectory

  return [pscustomobject]@{
    CODEX_HOME = $codexHome
    GH_CONFIG_DIR = $ghConfigDirectory
    GitHubCliConfigSource = $appDataGhDirectory
  }
}

if ($MyInvocation.InvocationName -ne '.') {
  Initialize-CodexEnvironment | Format-List
}
