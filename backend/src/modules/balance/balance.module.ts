import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { BalanceEntity } from '../../entities';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceEntity])],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}