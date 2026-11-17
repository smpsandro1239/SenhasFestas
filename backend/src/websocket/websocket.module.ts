import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventUserEntity, UserEntity } from '../entities';
import { OrderGateway } from './order.gateway';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([EventUserEntity, UserEntity])],
  providers: [OrderGateway],
  exports: [OrderGateway],
})
export class WebSocketModule {}