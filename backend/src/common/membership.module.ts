import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventUserEntity } from '../entities';
import { MembershipService } from './membership.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([EventUserEntity])],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}