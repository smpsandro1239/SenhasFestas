#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [1/5] Backend: instalar dependências"
(cd backend && npm ci)

echo "==> [2/5] Backend: testes e build"
(cd backend && npm run lint && npm test && npm run build)

echo "==> [3/5] Backend: aplicar migrações de base de dados"
if ! (cd backend && NODE_ENV=production npm run migration:run); then
  echo "!! Falha ao aplicar migrações. Deploy abortado." >&2
  exit 1
fi

echo "==> [4/5] Frontend: instalar dependências"
(cd frontend && npm ci)

echo "==> [5/5] Frontend: buildar"
(cd frontend && npm run build)

echo
echo "Deploy local pronto!"
echo "  Backend :  cd backend && npm run start:prod"
echo "  Frontend:  cd frontend && npm run start"