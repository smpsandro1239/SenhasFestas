import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditMiddleware } from '../middleware/audit.middleware';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { SecurityMiddleware } from '../middleware/security.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, AuditMiddleware, RateLimitMiddleware, SecurityMiddleware],
  exports: [AuditMiddleware, RateLimitMiddleware, SecurityMiddleware],
})
export class AppModule {}