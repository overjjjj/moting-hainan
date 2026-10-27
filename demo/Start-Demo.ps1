$ErrorActionPreference = 'Stop'
$demoRoot = $PSScriptRoot
$demoUrl = 'http://127.0.0.1:4173'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$demoNode = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $demoNode)) {
    Start-Process (Join-Path $demoRoot 'dist\index.html')
    Write-Host 'Node.js is unavailable. Opened the local HTML demo. Camera access may be unavailable.'
    exit
}
$demoReady = $false
try { $probe = Invoke-WebRequest -Uri "$demoUrl/index.html" -UseBasicParsing -TimeoutSec 2; $demoReady = $probe.Content -match 'INVERTER|mini.css' } catch {}
if (-not $demoReady) {
    $demoServer = Join-Path $demoRoot 'server.cjs'
    Start-Process -FilePath $demoNode -ArgumentList @('"' + $demoServer + '"') -WorkingDirectory $demoRoot -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        try { $probe = Invoke-WebRequest -Uri "$demoUrl/index.html" -UseBasicParsing -TimeoutSec 1; if ($probe.StatusCode -eq 200) { $demoReady = $true; break } } catch {}
    }
}
if ($demoReady) { Start-Process $demoUrl }
else { Write-Host 'Could not start port 4173. Run node server.cjs in this folder for details.'; Read-Host 'Press Enter to close' }

