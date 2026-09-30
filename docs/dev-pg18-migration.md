# Migração local do Postgres 15 → 18 (Docker Compose)

> **Só para desenvolvimento local.** A produção está no Neon, que tem o seu
> próprio caminho de upgrade (branching no console da Neon). Este documento
> **não** se aplica a ela.

## Porque é que é preciso fazer isto

A imagem oficial do Postgres mudou de layout no PG18:

| | PG15 e anteriores | PG18 e posteriores |
|---|---|---|
| `PGDATA` | `/var/lib/postgresql/data` | `/var/lib/postgresql/<major>/docker` |
| `VOLUME` declarado | `/var/lib/postgresql/data` | `/var/lib/postgresql` |

O commit `f439dae` actualizou `docker-compose.yml` para `postgres:18-alpine` e
moveu a montagem de `postgres_data:/var/lib/postgresql/data` para
`postgres_data:/var/lib/postgresql`.

**O que acontece com um volume antigo.** O `pg_upgrade` do PG18 não abre um
directório de dados de um major anterior. E com a montagem nova, o volume
antigo fica montado em `/var/lib/postgresql` enquanto o PG18 procura os dados
em `/var/lib/postgresql/18/docker` — que não existe. O contentor **não arranca
com erro claro**: inicializa uma base nova e vazia, e o `docker compose up`
parece ter funcionado.

É a parte perigosa desta migração: **a falha é silenciosa.** Se restaurares o
schema errado ou ficares com a base vazia e não reparares, vais descobrir isso
a meio de um evento.

Obrigatório, portanto: **dump antes, e confirmar que o restore restoreu.**

---

## 1. Decidir: precisas dos dados?

| Opção | Quando | Custo |
|---|---|---|
| **A — Arrancar limpo** | Só tens dados de teste; não te importas | 1 min |
| **B — Dump/restore** | Tens dados de dev que queres manter | ~10 min |

### Opção A — arrancar limpo

```bash
docker compose down
docker volume rm <projecto>_postgres_data
docker compose up -d postgres
```

O nome do volume tem o prefixo do projecto do Compose, que por omissão é o
nome da pasta. **Descobre o nome exacto antes de apagar** — `docker volume rm`
não perdoa:

```bash
docker volume ls | grep postgres
```

Depois de arrancar, aplica as migrations para criar o schema:

```bash
cd backend && npm run migration:run
```

> Confirma que o `.env` da raiz tem `POSTGRES_PASSWORD` e `JWT_SECRET`
> definidas. O compose usa `${VAR:?mensagem}` — sem elas o compose falha a
> interpretar o ficheiro.

### Opção B — dump antes, restore depois

**Antes de desligar o PG15**, faz o dump. Se desligares primeiro e o
`pg_dump` correr contra o PG18 vazio, perdes os dados sem teres feito nada de
errado.

```bash
# 1. Parar o Postgres (deixar o resto em pé é opcional)
docker compose stop postgres

# 2. Descobrir o nome real do volume
docker volume ls | grep postgres
#   -> senhasfestas_postgres_data   (o prefixo é o nome da pasta do compose)

# 3. Dump a partir de uma imagem PG15, sem acordar o contentor antigo
docker run --rm \
  -v <projecto>_postgres_data:/data:ro \
  -v "$(pwd)":/dump \
  postgres:15-alpine \
  pg_dump -U postgres -Fc -f /dump/dump.pgdump
```

Confirma que o ficheiro existe e não está vazio:

```bash
ls -lh dump.pgdump
pg_restore --list dump.pgdump | head -20   # se tiver Postgres local
```

Guarda o `dump.pgdump` **fora** da máquina ou num sítio seguro antes de
continuar. Se este passo correr mal, é a tua única cópia.

**Depois de subir o PG18:**

```bash
docker compose up -d postgres

# Esperar o healthcheck
docker compose ps
docker compose logs postgres | tail -20

# Confirmar que a base alvo existe e está vazia
docker exec -it senhasfestas-postgres psql -U postgres -c "\l"

# Restaurar
docker exec -i senhasfestas-postgres \
  pg_restore -U postgres -d senhasfestas --clean --if-exists < dump.pgdump
```

`-U postgres` e `-d senhasfestas` assumem os valores por omissão do compose.
Se o teu `.env` define `POSTGRES_USER` ou `POSTGRES_DB` diferentes, ajusta-os.

### Verificar que o restore restoreu

Nãoumes para o estado do contentor. Contar:

```bash
docker exec -it senhasfestas-postgres psql -U postgres -d senhasfestas \
  -c "SELECT count(*) FROM users;" -c "SELECT count(*) FROM products;" -c "SELECT count(*) FROM events;"
```

Se alguma devolve 0 e esperavas dados, **o restore falhou**. Repete a partir do
dump; não sigas para o migrate.

Depois, as migrations:

```bash
cd backend && npm run migration:run
```

O `migration:run` só aplica o que falta. Se já aplicaste tudo antes, é um
no-op.

---

## Notas que evitam perda de dados

1. **Dump antes de desligar o PG15.** O erro de ordem aqui é irreversível.
2. **`--clean --if-exists` no `pg_restore`**, senão o restore falha a criar
   objetos que já existem.
3. **Conta as tabelas depois.** Um restore que "não deu erro" e ficou vazio é
   indistinguível de um sucesso se não olhares.
4. **O Redis não precisa disto.** O upgrade 7→8 é um caminho suportado pela
   Redis, o `dump.rdb` do 7 é lido pelo 8, e o directório de dados continua a
   ser `/data`. O volume `redis_data` fica como está.
5. **Sem Docker, nada disto foi testado.** Este procedimento foi escrito a
   partir da documentação oficial das imagens, não de uma execução. Se alguma
   parte divergir do que vires, o erro diz-te o suficiente para ajustar.

---

## Alternativa: `pg_upgrade`

Se tiveres dados que **não** podes perder, `pg_dump`/`pg_restore` é mais lento
mas é o caminho mais seguro e o mais fácil de reverter. O `pg_upgrade` (link
duro entre versões, ou `--clone` com `--link`) é mais rápido e preserva tudo,
mas exige as duas versões instaladas lado a lado e tem as suas próprias
armadilhas com extensions. Para um volume de desenvolvimento, não compensa.

O PG18 documenta ainda que montar em `/var/lib/postgresql` existe
justamente para facilitar o `--link` do `pg_upgrade`. É relevante se algum dia
migrares um volume grande — não é o teu caso.

---

## Referências

- `docs/runbook-push-node-pg.md` — o push que traz estas mudanças
- `docs/deployment.md` — deploy por SSH
- Commit `f439dae` — a alteração que cria este problema