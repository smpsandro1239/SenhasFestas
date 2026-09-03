import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashClosureController } from './cash-closure.controller';
import { CashClosureService } from './cash-closure.service';
import { CashClosureEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([CashClosureEntity])],
  controllers: [CashClosureController],
  providers: [CashClosureService],
  exports: [CashClosureService],
})
export class CashClosureModule {}