import { IsString, IsNumber, IsArray, IsOptional, IsEnum } from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  @IsOptional()
  unitPrice?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateOrderDto {
  @IsString()
  eventId: string;

  @IsEnum(['qr', 'pos'])
  source: string;

  @IsString()
  @IsOptional()
  tableNumber?: string;

  @IsString()
  @IsOptional()
  station?: string;

  @IsString()
  @IsOptional()
  balanceId?: string;

  @IsEnum(['cash', 'mbway', 'balance'])
  @IsOptional()
  paymentMethod?: string;

  @IsNumber()
  total: number;

  @IsNumber()
  @IsOptional()
  balanceUsed?: number;

  @IsArray()
  items: CreateOrderItemDto[];
}

export class UpdateOrderStatusDto {
  @IsEnum(['received', 'preparing', 'ready', 'delivered', 'cancelled'])
  status: string;
}