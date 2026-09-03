import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicScreenController } from './public-screen.controller';
import { PublicScreenService } from './public-screen.service';
import { OrderEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity])],
  controllers: [PublicScreenController],
  providers: [PublicScreenService],
  exports: [PublicScreenService],
})
export class PublicScreenModule {}