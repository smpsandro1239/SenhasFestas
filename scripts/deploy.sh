#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [1/4] Backend: instalar dependências"
(cd backend && npm ci)

echo "==> [2/4] Backend: testes e build"
(cd backend && npm run lint && npm test && npm run build)

echo "==> [3/4] Backend: aplicar migrações de base de dados"
(cd backend && NODE_ENV=production npm run migration:run \
  || echo "!! Migrações não aplicadas. Verifique DATABASE_URL/.env e volte a correr.")

echo "==> [4/4] Frontend: instalar e buildar"
(cd frontend && npm ci && npm run build)

echo
echo "Deploy local pronto!"
echo "  Backend :  cd backend && npm run start:prod"
echo "  Frontend:  cd frontend && npm run start"