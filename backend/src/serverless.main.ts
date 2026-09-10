import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { criarAplicacao } from './app.setup';

let app: INestApplication | null = null;

export const handler = async (req: unknown, res: unknown): Promise<void> => {
  if (!app) {
    app = await criarAplicacao({ swagger: false });
    await app.init();
  }
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp(req, res);
};

export default handler;