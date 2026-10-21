# O repositório é um npm workspace: o lockfile e os manifestos vivem na raiz.
# O build context tem de ser a raiz do repositório (ver docker-compose.yml).
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --workspace=backend --include-workspace-root

COPY packages/shared ./packages/shared
COPY backend ./backend
RUN npm run build:shared && cd backend && npx nest build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
# --omit=dev não traz o typescript: o runtime não compila nada, recebe o
# pacote partilhado já compilado do builder (ver COPY abaixo).
RUN npm ci --workspace=backend --include-workspace-root --omit=dev

RUN mkdir -p /home/node/.npm

COPY --from=builder /app/backend/dist ./dist
# O symlink node_modules/@senhasfestas/shared aponta para packages/shared,
# por isso o dist tem de ser copiado para packages/shared/dist (e não para
# node_modules, que seria apenas um link para um directório sem conteúdo).
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3000

USER node

CMD ["node", "dist/main"]
