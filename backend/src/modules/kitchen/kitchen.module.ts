import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { OrderEntity, EventUserEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, EventUserEntity])],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}