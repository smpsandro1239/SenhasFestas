import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventEntity, EventUserEntity, OrderEntity, BalanceEntity, ProductEntity, BalanceMovementEntity, CategoryEntity, StationEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, EventUserEntity, OrderEntity, BalanceEntity, ProductEntity, BalanceMovementEntity, CategoryEntity, StationEntity])],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}