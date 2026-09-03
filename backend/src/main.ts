import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DatabaseSeederService } from './seeds/database.seeder';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    const seeder = app.get(DatabaseSeederService);
    await seeder.seed();
  }

  await app.listen(process.env.PORT || 3000);
}

bootstrap();