Param([switch]$Headless, [switch]$NoEngines)

if ($Headless -and -not $env:AI_GAMES_HEADLESS_HANDOFF) {
    $env:AI_GAMES_HEADLESS_HANDOFF = '1'
    Start-Process pwsh -ArgumentList '-NoProfile', '-File', $PSCommandPath, '-Headless' -WindowStyle Hidden
    exit
}

$ErrorActionPreference = "Continue"
$ScriptRoot = Split-Path -Parent $PSCommandPath
$BackendPort = 10987
$FleetStartPath = Join-Path $ScriptRoot "scripts\FleetStartMode.ps1"
if (-not (Test-Path -LiteralPath $FleetStartPath)) {
    Write-Host "ERROR: Missing vendored launcher helper: $FleetStartPath" -ForegroundColor Red
    exit 1
}
. $FleetStartPath

$FrontendPort = 10986
$EnginePorts = @(11211, 11212, 11213, 11216)

# Native engine wiring: registry ports (11211-11213, 11216), same scheme as Docker mode.
# Gateway reads STOCKFISH_URL/GO_URL/SHOGI_URL/OPENSPIEL_URL; engine servers read their *PORT vars.
$env:AI_STOCKFISH_PORT = "11211"
$env:KATAGO_PORT = "11213"
$env:YANEURAOU_PORT = "11212"
$env:STOCKFISH_URL = "http://localhost:11211"
$env:GO_URL = "http://localhost:11213"
$env:SHOGI_URL = "http://localhost:11212"
$env:OPENSPIEL_PORT = "11216"
$env:OPENSPIEL_URL = "http://localhost:11216"

Write-Host 'Starting ai-games-collection...' -ForegroundColor Cyan

# Port zombie clearing
$PortsToClear = @($BackendPort) + $EnginePorts
foreach ($port in $PortsToClear) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

# Start engine servers
if (-not $NoEngines) {
    Write-Host 'Starting AI engines...' -ForegroundColor Cyan
    $Engines = @(
        @{Name="Stockfish";  Script="engines\stockfish-server.py";  Port=11211},
        @{Name="KataGo";     Script="engines\go-server.py";         Port=11213},
        @{Name="YaneuraOu";  Script="engines\shogi-server.py";      Port=11212},
        @{Name="OpenSpiel";  Script="engines\open_spiel_server.py"; Port=11216}
    )
    foreach ($e in $Engines) {
        Start-Process pwsh -WindowStyle Hidden -ArgumentList @(
            "-NoProfile", "-Command",
            "uv run python `"$($ScriptRoot)\$($e.Script)`""
        )
        Write-Host "  $($e.Name) starting on port $($e.Port)..." -ForegroundColor Gray
    }
}

# Start FastAPI gateway
Write-Host 'Starting gateway...' -ForegroundColor Cyan
$BackendJob = Start-Job -Name "games-backend" -ScriptBlock {
    param($Root, $Port)
    Set-Location $Root
    uv run uvicorn web_sota.server:app --host 127.0.0.1 --port $Port --log-level warning
} -ArgumentList $ScriptRoot, $BackendPort

# Readiness poll
for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep 1
}

Write-Host "Gateway ready on http://127.0.0.1:$BackendPort" -ForegroundColor Green
Write-Host "Games:    http://127.0.0.1:$BackendPort/" -ForegroundColor Yellow
Write-Host "Engines:  Stockfish=11211  KataGo=11213  YaneuraOu=11212  OpenSpiel=11216" -ForegroundColor Gray
Write-Host "AI disabled: start with -NoEngines or run just serve" -ForegroundColor DarkGray

# Open browser
Start-Process "http://127.0.0.1:$BackendPort/"

# Keep-alive
while ($true) {
    if ($BackendJob.State -eq "Completed" -or $BackendJob.State -eq "Failed") {
        Receive-Job $BackendJob; break
    }
    Start-Sleep 2
}
