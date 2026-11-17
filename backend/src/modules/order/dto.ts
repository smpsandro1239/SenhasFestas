import {
  IsString,
  IsUUID,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
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
  @Max(999)
  quantity: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  notes?: string;
}

export class CreateOrderDto {
  @IsUUID()
  eventId: string;

  @IsEnum(['qr', 'pos'])
  source: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  tableNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  station?: string;

  @IsUUID()
  @IsOptional()
  balanceId?: string;

  @IsEnum(['cash', 'mbway', 'balance'])
  @IsOptional()
  paymentMethod?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
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