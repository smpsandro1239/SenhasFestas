import type { IncomingMessage, ServerResponse } from 'http';
import type { INestApplication } from '@nestjs/common';
import { criarAplicacao } from '../src/app.setup';

let app: INestApplication | null = null;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!app) {
    app = await criarAplicacao();
    await app.init();
  }
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp(req, res);
}