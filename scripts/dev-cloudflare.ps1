param(
  [int]$Port = 5174
)

$ErrorActionPreference = 'Stop'

function Require-Command {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] '$Name' is not installed." -ForegroundColor Red
    if ($InstallHint) {
      Write-Host "Install: $InstallHint" -ForegroundColor Yellow
    }
    exit 1
  }
}

function Test-PortOpen {
  param([int]$TargetPort)

  $client = $null
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect('127.0.0.1', $TargetPort, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne(350, $false) -and $client.Connected
    if ($connected) {
      $client.EndConnect($async) | Out-Null
      return $true
    }
    return $false
  } catch {
    return $false
  } finally {
    if ($client) { $client.Close() }
  }
}

function Wait-ForPort {
  param(
    [int]$TargetPort,
    [int]$TimeoutSec = 40
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen -TargetPort $TargetPort) {
      return $true
    }
    Start-Sleep -Milliseconds 400
  }
  return $false
}

Require-Command -Name 'cloudflared' -InstallHint 'winget install Cloudflare.cloudflared'
Require-Command -Name 'npm' -InstallHint 'Install Node.js from https://nodejs.org/'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$devJob = $null
$ownsDevJob = $false

if (Test-PortOpen -TargetPort $Port) {
  Write-Host "[INFO] Found running service on http://localhost:$Port. Reusing it." -ForegroundColor Cyan
} else {
  Write-Host "[1/2] Starting Vite dev server on http://localhost:$Port ..." -ForegroundColor Cyan
  $devJob = Start-Job -Name 'anima-snap-dev' -ScriptBlock {
    param($RootPath)
    Set-Location $RootPath
    npm run dev
  } -ArgumentList $projectRoot
  $ownsDevJob = $true

  if (-not (Wait-ForPort -TargetPort $Port -TimeoutSec 40)) {
    Write-Host "[ERROR] Vite did not start on port $Port within timeout." -ForegroundColor Red
    Write-Host "Recent dev logs:" -ForegroundColor Yellow
    Receive-Job -Job $devJob -Keep
    Stop-Job -Job $devJob -Force | Out-Null
    Remove-Job -Job $devJob -Force | Out-Null
    exit 1
  }
}

Write-Host "[2/2] Starting Cloudflare Tunnel..." -ForegroundColor Cyan
Write-Host "Open the https://*.trycloudflare.com URL printed below on your smartphone." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop tunnel." -ForegroundColor DarkGray

try {
  cloudflared tunnel --url "http://localhost:$Port"
} finally {
  if ($ownsDevJob -and $devJob) {
    if ($devJob.State -eq 'Running') {
      Stop-Job -Job $devJob -Force | Out-Null
    }
    Remove-Job -Job $devJob -Force | Out-Null
  }
}
