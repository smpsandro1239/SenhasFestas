import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductEntity, CategoryEntity } from '../../entities';
import { OrderGateway } from '../../websocket/order.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, CategoryEntity])],
  controllers: [CatalogController],
  providers: [CatalogService, OrderGateway],
  exports: [CatalogService],
})
export class CatalogModule {}