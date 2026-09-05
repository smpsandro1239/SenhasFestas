# SenhasFestas - ambiente de desenvolvimento (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

# 1. Infraestrutura (Postgres + Redis)
if (Get-Command "docker" -ErrorAction SilentlyContinue) {
  Write-Host "==> A garantir Postgres + Redis via docker compose"
  docker compose up -d postgres redis
} else {
  Write-Host "!! Docker não encontrado. Configure Postgres e Redis manualmente."
}

# 2. Dependências
Write-Host "==> A instalar dependências do backend"
Push-Location "backend"
npm.cmd install
Pop-Location

Write-Host "==> A instalar dependências do frontend"
Push-Location "frontend"
npm.cmd install
Pop-Location

Write-Host ""
Write-Host "Infraestrutura pronta."
Write-Host "Postgres/Redis prontos. Para iniciar as aplicações:"
Write-Host "  Backend :  cd backend  ; npm.cmd run start:dev"
Write-Host "  Frontend:  cd frontend ; npm.cmd run dev"
Write-Host "  Swagger :  http://localhost:3000/api/docs"