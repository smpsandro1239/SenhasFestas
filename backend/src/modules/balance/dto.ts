import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class LoadBalanceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsUUID()
  @IsOptional()
  eventId?: string;
}

export class CreateBalanceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsUUID()
  @IsOptional()
  eventId?: string;
}