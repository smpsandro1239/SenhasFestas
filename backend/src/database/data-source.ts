import 'dotenv/config';
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import * as migrations from './migrations';

export function configuracaoDataSource(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const databaseUrl = env.DATABASE_URL;
  let host = env.DB_HOST || 'localhost';
  let port = Number.parseInt(env.DB_PORT || '5432', 10);
  let username = env.DB_USERNAME || 'postgres';
  let password = env.DB_PASSWORD || 'postgres';
  let database = env.DB_NAME || 'senhasfestas';
  let sslMode: string | null = null;

  if (databaseUrl) {
    const url = new URL(databaseUrl);
    host = url.hostname;
    port = Number.parseInt(url.port || '5432', 10);
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    const databasePath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    database = decodeURIComponent(databasePath);
    sslMode = url.searchParams.get('sslmode');
  }

  // O CLI do TypeORM (migrations) tem de aplicar a mesma política TLS da API.
  // Nunca aceitar certificados arbitrários em ligações remotas.
  const sslEnabled = env.DB_SSL === 'true' || (sslMode !== null && sslMode !== 'disable');
  const ssl = sslEnabled
    ? {
        rejectUnauthorized: true,
        ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA } : {}),
      }
    : undefined;

  return {
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    ssl,
    entities: [__dirname + '/../entities/index.ts'],
    // Registry estática: evita que o CLI carregue ficheiros *.spec.ts como
    // migrations e mantém o conjunto igual ao usado pelo arranque da API.
    migrations: Object.values(migrations).filter((v) => typeof v === 'function'),
    synchronize: false,
    logging: false,
  };
}

export const AppDataSource = new DataSource(configuracaoDataSource());
