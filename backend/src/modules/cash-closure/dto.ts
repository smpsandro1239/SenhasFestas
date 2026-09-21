import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateCashClosureDto {
  @IsUUID()
  eventId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  openingBalance?: number;

  @IsString()
  @IsOptional()
  closingMethod?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CloseCashClosureDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  totalActual: number;

  @IsString()
  @IsOptional()
  notes?: string;
}