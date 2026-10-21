#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# O lockfile vive na raiz (npm workspaces: backend, frontend, packages/shared).
# Instalar por pasta deixaria o pacote partilhado por resolver.
echo "==> [1/6] Dependências (npm ci na raiz — workspaces)"
npm ci

echo "==> [2/6] Pacote partilhado: build"
npm run build:shared

echo "==> [3/6] Backend: testes e build"
(cd backend && npm run lint && npm test && npm run build)

echo "==> [4/6] Backend: aplicar migrações de base de dados"
if ! (cd backend && NODE_ENV=production npm run migration:run); then
  echo "!! Falha ao aplicar migrações. Deploy abortado." >&2
  exit 1
fi

echo "==> [5/6] Frontend: build"
(cd frontend && npm run build)

echo "==> [6/6] Concluído"
echo
echo "Deploy local pronto!"
echo "  Backend :  cd backend && npm run start:prod"
echo "  Frontend:  cd frontend && npm run start"
