import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventController } from './event.controller';
import { EventPublicController } from './event-public.controller';
import { FloorPlanController } from './floor-plan.controller';
import { EventService } from './event.service';
import { FloorPlanService } from './floor-plan.service';
import { AuditModule } from '../audit/audit.module';
import { EventEntity, EventUserEntity, OrderEntity, BalanceEntity, ProductEntity, BalanceMovementEntity, CategoryEntity, StationEntity, CashClosureEntity, FloorPlanEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, EventUserEntity, OrderEntity, BalanceEntity, ProductEntity, BalanceMovementEntity, CategoryEntity, StationEntity, CashClosureEntity, FloorPlanEntity]), AuditModule],
  controllers: [EventPublicController, EventController, FloorPlanController],
  providers: [EventService, FloorPlanService],
  exports: [EventService],
})
export class EventModule {}
