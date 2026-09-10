import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppModule } from './app.module';

export async function criarAplicacao(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const rawTrustProxy = configService.get<string>('TRUST_PROXY');
  const trustProxy =
    rawTrustProxy !== undefined && rawTrustProxy !== ''
      ? Number(rawTrustProxy)
      : process.env.NODE_ENV === 'production'
        ? 1
        : undefined;

  if (trustProxy !== undefined) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  }

  if (trustProxy !== undefined) {
    app.use((req, res, next) => {
      if (!req.secure) {
        return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
      }
      next();
    });
  }

  app.setGlobalPrefix('api', { exclude: ['api/docs'] });

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('SenhasFestas API')
    .setDescription('SaaS para gestão de senhas/tokens para consumo em festas de aldeia')
    .setVersion('1.0')
    .addTag('SenhasFestas')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  return app;
}

export function configuracaoBaseDados(configService: ConfigService) {
  const databaseUrl = configService.get<string>('DATABASE_URL');
  if (!databaseUrl) {
    return {
      host: configService.get<string>('DB_HOST') ?? 'localhost',
      port: configService.get<number>('DB_PORT') ?? 5432,
      username: configService.get<string>('DB_USERNAME') ?? 'postgres',
      password: configService.get<string>('DB_PASSWORD') ?? 'postgres',
      database: configService.get<string>('DB_NAME') ?? 'senhasfestas',
      ssl:
        configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : undefined,
    };
  }

  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    ssl:
      url.searchParams.get('sslmode') === 'require' ||
      configService.get<string>('DB_SSL') === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  };
}