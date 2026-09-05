import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OrdensQueryDto {
  @IsEnum(['received', 'preparing', 'ready', 'delivered', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  station?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SaldoQueryDto {
  @IsUUID()
  @IsOptional()
  id?: string;
}

export class TopProductsQueryDto {
  @IsUUID()
  @IsOptional()
  eventId?: string;
}