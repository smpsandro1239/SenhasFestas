import { ConfigService } from '@nestjs/config';
import { DatabaseSeederService } from './seeds/database.seeder';
import { ProductSeederService } from './seeds/product.seeder';
import { criarAplicacao } from './app.setup';

async function bootstrap() {
  const app = await criarAplicacao();
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