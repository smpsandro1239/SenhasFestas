import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'senhasfestas',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  entities: [__dirname + '/../entities/index.ts'],
  // Só os ficheiros das migrations (`<timestamp>-<Nome>.ts`). Um glob `*.ts`
  // apanhava também o `index.spec.ts` da pasta — o CLI do TypeORM carregava-o
  // e o import de `vitest` rebentava em CommonJS ("Vitest cannot be imported
  // in a CommonJS module"). O registo das migrations em runtime é o registry
  // estático (`migrations/index.ts`), não este glob.
  migrations: [__dirname + '/migrations/[0-9]*.ts'],
  synchronize: false,
  logging: false,
});