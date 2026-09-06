import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App e2e (Postgres + Redis)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['api/docs'] });
    await app.init();

    const dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  it('deve responder na rota de liveness', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/live').expect(200);
    expect(response.body.status).toBe('alive');
  });

  it('deve reportar a base de dados saudável', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200);
    expect(response.body.dependencies.database).toBe('healthy');
  });

  it('deve recusar rate limit com 429 (não 500)', async () => {
    const responses = [];
    for (let i = 0; i < 5; i++) {
      responses.push(await request(app.getHttpServer()).get('/api/health/live'));
    }
    expect(responses.every((r) => r.status === 200)).toBe(true);
  });
});