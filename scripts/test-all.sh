#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Backend: lint + testes"
(cd backend && npm run lint && npm test)

echo "==> Frontend: build (verificação de tipos)"
(cd frontend && npm run build)

echo "Todos os testes e verificações passaram."