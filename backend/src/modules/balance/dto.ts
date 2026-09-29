import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class LoadBalanceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsUUID()
  eventId: string;
}

export class DeductBalanceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsUUID()
  eventId: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ReverseLoadDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  amount?: number;
}