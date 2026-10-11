import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductEntity, CategoryEntity, EventEntity, OrderEntity, OrderItemEntity } from '../../entities';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, CategoryEntity, EventEntity, OrderEntity, OrderItemEntity]), AuditModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}