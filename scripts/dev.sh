#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

MODE="${1:-auto}"

case "$MODE" in
  docker)
    echo "==> Modo DOCKER: stack completa em containers"
    echo "    docker compose up -d --build"
    docker compose up -d --build
    echo
    echo "Pronto! Frontend : http://localhost:3001"
    echo "         Api      : http://localhost:3000/api"
    echo "         Swagger  : http://localhost:3000/api/docs"
    echo "         Parar    : npm run docker:down"
    echo "         Logs     : npm run docker:logs"
    ;;
  nativo)
    echo "==> Modo NATIVO: apps locais + infra postgres/redis local"
    echo "    Assume Postgres e Redis instalados localmente e a correr."
    echo "    Confira backend/.env (DB_HOST/DB_PORT/REDIS_URL)."
    ;;
  auto|"")
    echo "==> Modo HÍBRIDO: infra (postgres+redis) em Docker, apps locais"
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      echo "==> A subir postgres e redis via docker compose"
      docker compose up -d postgres redis
    else
      echo "!! Docker não está disponível a correr."
      echo "   Use a possibilidade NATIVA (sem Docker): instale Postgres e Redis"
      echo "   e execute:  ./scripts/dev.sh nativo   (ou npm run dev)"
    fi
    ;;
  *)
    echo "Uso: ./scripts/dev.sh [auto|docker|nativo]"
    echo "  auto    (padrão) apps locais + postgres/redis em Docker"
    echo "  docker  stack completa em containers (inclui backend e frontend)"
    echo "  nativo  tudo local (sem Docker em lado nenhum)"
    exit 1
    ;;
esac

if [ "$MODE" != "docker" ]; then
  echo
  echo "==> A instalar dependências do backend"
  (cd backend && npm install)

  echo "==> A instalar dependências do frontend"
  (cd frontend && npm install)

  echo
  echo "Para iniciar as aplicações:"
  echo "  Backend :  cd backend  && npm run start:dev"
  echo "  Frontend:  cd frontend && npm run dev"
  echo "  Swagger :  http://localhost:3000/api/docs"
fi