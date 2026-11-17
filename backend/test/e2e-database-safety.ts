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
 * Os E2E podem apagar o schema public. Exigir simultaneamente opt-in explícito,
 * host loopback e nome de BD dedicado impede que um .env apontado para produção
 * ou para a Neon transforme um comando de teste numa operação destrutiva remota.
 */
export function configuracaoBaseDadosE2e(
  ambiente: AmbienteE2e = process.env,
): ConfiguracaoBaseDadosE2e {
  if (ambiente.E2E_ALLOW_SCHEMA_RESET !== 'true') {
    throw new Error(
      'E2E bloqueado: define E2E_ALLOW_SCHEMA_RESET=true apenas para autorizar testes numa base de dados descartável.',
    );
  }

  let url: URL | undefined;
  if (ambiente.DATABASE_URL) {
    try {
      url = new URL(ambiente.DATABASE_URL);
    } catch {
      throw new Error('E2E bloqueado: DATABASE_URL não é um URL PostgreSQL válido.');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('E2E bloqueado: DATABASE_URL tem de usar o protocolo PostgreSQL.');
    }
  }

  const host = (url?.hostname || ambiente.DB_HOST || 'localhost').toLowerCase();
  if (!HOSTS_LOCAIS.has(host)) {
    throw new Error(
      `E2E bloqueado: o host "${host}" não é local. Os testes E2E nunca podem executar contra uma base de dados remota.`,
    );
  }

  const database = decodeURIComponent(
    url?.pathname.replace(/^\/+/, '') || ambiente.DB_NAME || 'senhasfestas',
  );
  if (!BASE_DADOS_TESTE.test(database)) {
    throw new Error(
      `E2E bloqueado: a base de dados "${database}" não termina em _test ou _e2e. Usa uma base de dados descartável dedicada.`,
    );
  }

  const sslMode = url?.searchParams.get('sslmode');
  const ssl = ambiente.DB_SSL === 'true' || (sslMode !== null && sslMode !== 'disable')
    ? { rejectUnauthorized: false }
    : undefined;

  if (url) {
    return { connectionString: ambiente.DATABASE_URL, ssl };
  }

  return {
    host,
    port: Number(ambiente.DB_PORT || 5432),
    user: ambiente.DB_USERNAME || 'postgres',
    password: ambiente.DB_PASSWORD || 'postgres',
    database,
    ssl,
  };
}
