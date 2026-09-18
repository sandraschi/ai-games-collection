# Engine Binary Download Script
# Downloads AI engine executables for ai-games-collection. Run once after clone.
param([switch]$Force)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSCommandPath
$RepoRoot = Split-Path -Parent $Root

function Require-Binary($Name, $Path, $Url, $Description) {
    $fullPath = Join-Path $RepoRoot $Path
    if ((Test-Path $fullPath) -and (-not $Force)) {
        Write-Host "  $Name : present" -ForegroundColor Green
        return
    }
    Write-Host "  $Name : downloading..." -ForegroundColor Yellow
    Write-Host "    URL: $Url"
    Write-Host "    $Description"
    $parent = Split-Path -Parent $fullPath
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    try {
        Invoke-WebRequest -Uri $Url -OutFile $fullPath -UseBasicParsing
        Write-Host "    Downloaded: $fullPath" -ForegroundColor Green
    } catch {
        Write-Host "    FAILED: $_" -ForegroundColor Red
        Write-Host "    Download manually from: $Url" -ForegroundColor Yellow
    }
}

Write-Host "=== ai-games-collection Engine Binary Download ===" -ForegroundColor Cyan
Write-Host "Downloads missing AI engine binaries. Re-run with -Force to re-download all."
Write-Host ""

# Stockfish 16 (chess)
Require-Binary "Stockfish 16" "stockfish/stockfish-windows-x86-64-avx2.exe" `
    "https://github.com/official-stockfish/Stockfish/releases/download/sf_16/stockfish-windows-x86-64-avx2.exe" `
    "Windows AVX2 build"

# KataGo 1.16.5 (Go)
Require-Binary "KataGo 1.16.5" "katago/katago.exe" `
    "https://github.com/lightvector/KataGo/releases/download/v1.16.5/katago-v1.16.5-eigenavx2-windows-x64.zip" `
    "Extract katago.exe from the zip to katago/"

# YaneuraOu 9.40 (Shogi)
Require-Binary "YaneuraOu ORT-CPU" "yaneuraou/YaneuraOu-Deep-ORT-CPU.exe" `
    "https://github.com/yaneurao/YaneuraOu/releases/download/v9.40/YaneuraOu-Deep-ORT-CPU.zip" `
    "Extract exe and onnxruntime.dll to yaneuraou/"

# Edax 4.6 (Othello)
$edaxDir = "engines/data"
New-Item -ItemType Directory -Force -Path $edaxDir | Out-Null
Require-Binary "Edax 4.6 (exe)" "engines/data/wEdax-x86-64-v2.exe" `
    "https://github.com/abulmo/edax-reversi/releases/download/v4.6/edax-4.6-MS-windows-x86.zip" `
    "Extract wEdax-x86-64-v2.exe from the zip to engines/data/"
if ((Test-Path "$RepoRoot\engines\data\eval.dat") -and (-not $Force)) {
    Write-Host "  Edax eval.dat : present" -ForegroundColor Green
} else {
    $edaxZip = "$env:TEMP\edax-dl.zip"
    try {
        Invoke-WebRequest -Uri "https://github.com/abulmo/edax-reversi/releases/download/v4.6/edax-4.6-MS-windows-x86.zip" -OutFile $edaxZip -UseBasicParsing
        $edaxExtract = "$env:TEMP\edax-extract"
        Expand-Archive -Path $edaxZip -DestinationPath $edaxExtract -Force
        if (Test-Path "$edaxExtract\data\eval.dat") {
            Copy-Item "$edaxExtract\data\eval.dat" "$RepoRoot\engines\data\eval.dat" -Force
            Write-Host "  Edax eval.dat : downloaded" -ForegroundColor Green
        }
    } catch { Write-Host "  Edax eval.dat download failed: $_" -ForegroundColor Red }
}

# cloudflared (tunnel)
Require-Binary "cloudflared" "scripts/tunnel/cloudflared.exe" `
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" `
    "Cloudflare Tunnel client"

# ngrok (tunnel)
Require-Binary "ngrok" "scripts/tunnel/ngrok.exe" `
    "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" `
    "Extract ngrok.exe from the zip to scripts/tunnel/"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "OpenSpiel: native via venv dependency open-spiel (engines/open_spiel_server.py, port 11216) or Docker (docker compose up openspiel-engine)."
Write-Host "KataGo .dll files: extract from the KataGo zip alongside katago.exe."
