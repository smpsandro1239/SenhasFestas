import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { OrderEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity])],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}