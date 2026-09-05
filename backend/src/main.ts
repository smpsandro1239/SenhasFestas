import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DatabaseSeederService } from './seeds/database.seeder';
import { ProductSeederService } from './seeds/product.seeder';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  (app as any).enable('trust proxy');

  if (process.env.NODE_ENV === 'production') {
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

  const configService = app.get(ConfigService);
  if (configService.get<string>('NODE_ENV') === 'development') {
    const dbSeeder = app.get(DatabaseSeederService);
    await dbSeeder.seed();

    const productSeeder = app.get(ProductSeederService);
    await productSeeder.seed();
  }

  await app.listen(process.env.PORT || 3000);
  console.log(`[Bootstrap] API a correr em http://localhost:${process.env.PORT || 3000}`);
  console.log(`[Bootstrap] Swagger: http://localhost:${process.env.PORT || 3000}/api/docs`);
}

bootstrap();