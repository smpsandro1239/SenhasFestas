#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Infraestrutura (Postgres + Redis)
if command -v docker >/dev/null 2>&1; then
  echo "==> A garantir Postgres + Redis via docker compose"
  docker compose up -d postgres redis
else
  echo "!! Docker não encontrado. Configure Postgres e Redis manualmente."
fi

# 2. Backend
echo "==> A instalar dependências do backend"
(cd backend && npm install)

# 3. Frontend
echo "==> A instalar dependências do frontend"
(cd frontend && npm install)

echo
echo "Infraestrutura pronta."
echo "Postgres/Redis prontos. Para iniciar as aplicações:"
echo "  Backend :  cd backend  && npm run start:dev"
echo "  Frontend:  cd frontend && npm run dev"
echo "  Swagger :  http://localhost:3000/api/docs"