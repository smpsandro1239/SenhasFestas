import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

export interface AmbienteE2e {
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
  DB_SSL?: string;
  E2E_ALLOW_SCHEMA_RESET?: string;
}

export interface ConfiguracaoBaseDadosE2e {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: { rejectUnauthorized: boolean };
}

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const BASE_DADOS_TESTE = /_(?:test|e2e)$/i;

/**
 * Replica a precedência do ConfigModule.forRoot({ envFilePath:
 * ['.env.development', '.env'] }): o primeiro ficheiro prevalece e variáveis
 * já existentes no processo têm prioridade sobre ambos.
 *
 * É essencial ler os ficheiros antes de criar a aplicação: o pré-voo corre
 * antes de o Nest ConfigModule carregar o .env.
 */
export function carregarAmbienteE2e(
  diretorio = process.cwd(),
  processo: NodeJS.ProcessEnv = process.env,
): AmbienteE2e {
  const ficheiros: Record<string, string> = {};

  for (const nome of ['.env.development', '.env']) {
    const caminho = resolve(diretorio, nome);
    if (!existsSync(caminho)) continue;

    const valores = parse(readFileSync(caminho));
    for (const [chave, valor] of Object.entries(valores)) {
      if (!(chave in ficheiros)) {
        ficheiros[chave] = valor;
      }
    }
  }

  return { ...ficheiros, ...processo } as AmbienteE2e;
}

/**
 * Os E2E podem apagar o schema public. Exigir simultaneamente opt-in explícito,
 * host loopback e nome de BD dedicado impede que um .env apontado para produção
 * ou para a Neon transforme um comando de teste numa operação destrutiva remota.
 */
export function configuracaoBaseDadosE2e(
  ambiente?: AmbienteE2e,
): ConfiguracaoBaseDadosE2e {
  const config = ambiente ?? carregarAmbienteE2e();

  if (config.E2E_ALLOW_SCHEMA_RESET !== 'true') {
    throw new Error(
      'E2E bloqueado: define E2E_ALLOW_SCHEMA_RESET=true apenas para autorizar testes numa base de dados descartável.',
    );
  }

  let url: URL | undefined;
  if (config.DATABASE_URL) {
    try {
      url = new URL(config.DATABASE_URL);
    } catch {
      throw new Error('E2E bloqueado: DATABASE_URL não é um URL PostgreSQL válido.');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('E2E bloqueado: DATABASE_URL tem de usar o protocolo PostgreSQL.');
    }
  }

  const host = (url?.hostname || config.DB_HOST || 'localhost').toLowerCase();
  if (!HOSTS_LOCAIS.has(host)) {
    throw new Error(
      `E2E bloqueado: o host "${host}" não é local. Os testes E2E nunca podem executar contra uma base de dados remota.`,
    );
  }

  const database = decodeURIComponent(
    url?.pathname.replace(/^\/+/, '') || config.DB_NAME || 'senhasfestas',
  );
  if (!BASE_DADOS_TESTE.test(database)) {
    throw new Error(
      `E2E bloqueado: a base de dados "${database}" não termina em _test ou _e2e. Usa uma base de dados descartável dedicada.`,
    );
  }

  const sslMode = url?.searchParams.get('sslmode');
  const ssl = config.DB_SSL === 'true' || (url !== undefined && sslMode !== null && sslMode !== 'disable')
    ? { rejectUnauthorized: false }
    : undefined;

  if (url) {
    return { connectionString: config.DATABASE_URL, ssl };
  }

  return {
    host,
    port: Number(config.DB_PORT || 5432),
    user: config.DB_USERNAME || 'postgres',
    password: config.DB_PASSWORD || 'postgres',
    database,
    ssl,
  };
}
