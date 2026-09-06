import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductEntity, CategoryEntity, EventEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, CategoryEntity, EventEntity])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}