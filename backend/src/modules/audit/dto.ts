import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;
}
