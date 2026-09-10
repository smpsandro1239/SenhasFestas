import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicScreenController } from './public-screen.controller';
import { PublicScreenService } from './public-screen.service';
import { OrderEntity, EventUserEntity, EventEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, EventUserEntity, EventEntity])],
  controllers: [PublicScreenController],
  providers: [PublicScreenService],
  exports: [PublicScreenService],
})
export class PublicScreenModule {}