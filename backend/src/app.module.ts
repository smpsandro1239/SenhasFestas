import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {
  static setup(app: any) {
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
}