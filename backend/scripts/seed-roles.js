require('dotenv/config');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module.js');
const { DatabaseSeederService } = require('../dist/seeds/database.seeder.js');

(async () => {
  const context = await NestFactory.createApplicationContext(AppModule);
  try {
    await context.get(DatabaseSeederService).seed();
    console.log(
      '[seed:roles] contas de teste garantidas (admin, organizer, cashier, kitchen, bar, treasurer, client)',
    );
  } finally {
    await context.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});