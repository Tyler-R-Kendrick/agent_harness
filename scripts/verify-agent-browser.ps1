$ErrorActionPreference = 'Stop'

$steps = @(
  @{ Label = 'source-hygiene'; Args = @('run', 'check:generated-files') }
  @{ Label = 'validate-evals'; Args = @('--workspace', 'agent-browser', 'run', 'validate:evals') }
  @{ Label = 'test-evals'; Args = @('--workspace', 'agent-browser', 'run', 'test:evals') }
  @{ Label = 'test-scripts'; Args = @('--workspace', 'agent-browser', 'run', 'test:scripts') }
  @{ Label = 'lint'; Args = @('--workspace', 'agent-browser', 'run', 'lint') }
  @{ Label = 'coverage'; Args = @('--workspace', 'agent-browser', 'run', 'test:coverage') }
  @{ Label = 'build'; Args = @('--workspace', 'agent-browser', 'run', 'build') }
  @{ Label = 'audit-lockfile'; Args = @('install', '--package-lock-only', '--ignore-scripts') }
  @{ Label = 'audit'; Args = @('audit', '--audit-level=moderate') }
  @{ Label = 'visual-smoke'; Args = @('run', 'visual:agent-browser') }
)

$warningPatterns = @(
  '(?i)npm warn',
  '\(!\)',
  '\[plugin vite:reporter\]',
  '(?i)warn exec The following package was not found'
)

$maxAttempts = 2

foreach ($step in $steps) {
  Write-Output "verify:agent-browser starting $($step.Label)."
  $exitCode = 0
  $outputFile = $null

  try {
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
      if ($outputFile) {
        Remove-Item -LiteralPath $outputFile -Force -ErrorAction SilentlyContinue
      }
      $outputFile = [System.IO.Path]::GetTempFileName()

      $previousErrorActionPreference = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      & npm.cmd @($step.Args) 2>&1 | Tee-Object -FilePath $outputFile
      $exitCode = $LASTEXITCODE
      $ErrorActionPreference = $previousErrorActionPreference

      if ($exitCode -eq 0) {
        break
      }

      if ($attempt -lt $maxAttempts) {
        Write-Output "verify:agent-browser step $($step.Label) failed with exit code $exitCode; retrying once."
      }
    }

    if ($exitCode -ne 0) {
      exit $exitCode
    }

    $output = Get-Content -LiteralPath $outputFile -Raw
    foreach ($pattern in $warningPatterns) {
      if ($output -match $pattern) {
        Write-Error "verify:agent-browser failed: $($step.Label) emitted a warning matching $pattern."
        exit 1
      }
    }
  } finally {
    Remove-Item -LiteralPath $outputFile -Force -ErrorAction SilentlyContinue
  }
}
