import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { hostConfiavel } from './middleware/security.middleware';
import { AppModule } from './app.module';

export interface CriarAplicacaoOpcoes {
  swagger?: boolean;
}

export async function criarAplicacao(opcoes: CriarAplicacaoOpcoes = {}): Promise<INestApplication> {
  const swagger = opcoes.swagger ?? true;
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
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
    const trustedHosts = new Set([
      ...(process.env.FRONTEND_URL || 'http://localhost:3001')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, '')),
      ...(process.env.API_TRUSTED_HOSTS || '')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean),
    ]);

    app.use((req, res, next) => {
      if (!req.secure) {
        // Open redirect fix (A6): o 301 antigo refletia qualquer Host
        // (https://${req.headers.host}) — um atacante controlava o domínio do
        // redirect. Só redireciona para hosts confiáveis: FRONTEND_URL,
        // API_TRUSTED_HOSTS, localhost, ou *.vercel.app (previews não partem).
        const host = String(req.headers.host || '');
        if (!hostConfiavel(host, trustedHosts)) {
          return res.status(400).json({ statusCode: 400, message: 'Host não permitido' });
        }
        return res.redirect(301, `https://${host}${req.originalUrl}`);
      }
      next();
    });
  }

  app.use(cookieParser());

  app.setGlobalPrefix('api', { exclude: ['api/docs'] });

  const corsOrigins = (process.env.FRONTEND_URL || 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    // A6: allowlist explícita (array), não reflete a origem do pedido.
    // Alinhada com o security.middleware e o order.gateway (ambos fazem split).
    origin: corsOrigins,
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

  if (swagger) {
    const alvo = '@nestjs/swagger';
    const { DocumentBuilder, SwaggerModule } = await import(alvo);
    const config = new DocumentBuilder()
      .setTitle('SenhasFestas API')
      .setDescription('SaaS para gestão de senhas/tokens para consumo em festas de aldeia')
      .setVersion('1.0')
      .addTag('SenhasFestas')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

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