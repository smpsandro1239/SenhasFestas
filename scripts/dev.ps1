# SenhasFestas - ambiente de desenvolvimento (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$MODE = if ($args.Count -gt 0) { $args[0] } else { "auto" }

switch ($MODE) {
  "docker" {
    Write-Host "==> Modo DOCKER: stack completa em containers"
    Write-Host "    docker compose up -d --build"
    docker compose up -d --build
    if ($?) {
      Write-Host ""
      Write-Host "Pronto! Frontend : http://localhost:3001"
      Write-Host "         Api      : http://localhost:3000/api"
      Write-Host "         Swagger  : http://localhost:3000/api/docs"
      Write-Host "         Parar    : npm.cmd run docker:down"
      Write-Host "         Logs     : npm.cmd run docker:logs"
    }
  }
  "nativo" {
    Write-Host "==> Modo NATIVO: apps locais + infra postgres/redis local"
    Write-Host "    Assume Postgres e Redis instalados localmente e a correr."
    Write-Host "    Confira backend/.env (DB_HOST/DB_PORT/REDIS_URL)."
  }
  "auto" {
    Write-Host "==> Modo HIBRIDO: infra (postgres+redis) em Docker, apps locais"
    $hasDocker = Get-Command "docker" -ErrorAction SilentlyContinue
    if ($hasDocker) {
      docker info *> $null
      if ($?) {
        Write-Host "==> A subir postgres e redis via docker compose"
        docker compose up -d postgres redis
      } else {
        Write-Host "!! Docker nao esta a correr. A iniciar so com apps locais."
      }
    } else {
      Write-Host "!! Docker nao encontrado."
      Write-Host "   Use a possibilidade NATIVA (sem Docker): instale Postgres e Redis"
      Write-Host "   e execute:  .\scripts\dev.ps1 nativo   (ou npm.cmd run dev)"
    }
  }
  default {
    Write-Host "Uso: .\scripts\dev.ps1 [auto|docker|nativo]"
    Write-Host "  auto    (padrao) apps locais + postgres/redis em Docker"
    Write-Host "  docker  stack completa em containers (inclui backend e frontend)"
    Write-Host "  nativo  tudo local (sem Docker em lado nenhum)"
    exit 1
  }
}

if ($MODE -ne "docker") {
  # Dependências
  Write-Host "==> A instalar dependencias do backend"
  Push-Location "backend"
  npm.cmd install
  Pop-Location

  Write-Host "==> A instalar dependencias do frontend"
  Push-Location "frontend"
  npm.cmd install
  Pop-Location

  Write-Host ""
  Write-Host "Para iniciar as aplicacoes:"
  Write-Host "  Backend :  cd backend  ; npm.cmd run start:dev"
  Write-Host "  Frontend:  cd frontend ; npm.cmd run dev"
  Write-Host "  Swagger :  http://localhost:3000/api/docs"
}