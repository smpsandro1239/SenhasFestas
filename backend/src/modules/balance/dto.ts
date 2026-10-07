import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

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

export class ExtendBalanceDto {
  @IsUUID()
  eventId: string;

  @IsDateString()
  until: string;
}

export class BalanceEventDto {
  @IsUUID()
  eventId: string;
}