$ErrorActionPreference = 'Stop'

$steps = @(
  @{ Label = 'validate-evals'; Args = @('--workspace', 'agent-browser', 'run', 'validate:evals') }
  @{ Label = 'test-evals'; Args = @('--workspace', 'agent-browser', 'run', 'test:evals') }
  @{ Label = 'test-scripts'; Args = @('--workspace', 'agent-browser', 'run', 'test:scripts') }
  @{ Label = 'lint'; Args = @('--workspace', 'agent-browser', 'run', 'lint') }
  @{ Label = 'coverage'; Args = @('--workspace', 'agent-browser', 'run', 'test:coverage') }
  @{ Label = 'build'; Args = @('--workspace', 'agent-browser', 'run', 'build') }
  @{ Label = 'audit'; Args = @('audit', '--audit-level=moderate') }
  @{ Label = 'visual-smoke'; Args = @('run', 'visual:agent-browser') }
)

$warningPatterns = @(
  '(?i)npm warn',
  '\(!\)',
  '\[plugin vite:reporter\]',
  '(?i)warn exec The following package was not found'
)

foreach ($step in $steps) {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $outputLines = & npm.cmd @($step.Args) 2>&1
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  foreach ($line in $outputLines) {
    Write-Output $line
  }

  if ($exitCode -ne 0) {
    exit $exitCode
  }

  $output = ($outputLines | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
  foreach ($pattern in $warningPatterns) {
    if ($output -match $pattern) {
      Write-Error "verify:agent-browser failed: $($step.Label) emitted a warning matching $pattern."
      exit 1
    }
  }
}
