import {
  IsString,
  IsUUID,
  IsInt,
  Min,
  IsArray,
  IsOptional,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateOrderDto {
  @IsUUID()
  eventId: string;

  @IsEnum(['qr', 'pos'])
  source: string;

  @IsString()
  @IsOptional()
  tableNumber?: string;

  @IsString()
  @IsOptional()
  station?: string;

  @IsUUID()
  @IsOptional()
  balanceId?: string;

  @IsEnum(['cash', 'mbway', 'balance'])
  @IsOptional()
  paymentMethod?: string;

  @Min(0)
  @IsOptional()
  balanceUsed?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class UpdateOrderStatusDto {
  @IsEnum(['received', 'preparing', 'ready', 'delivered', 'cancelled'])
  status: string;
}

export class ListOrdersQueryDto {
  @IsUUID()
  @IsOptional()
  eventId?: string;
}