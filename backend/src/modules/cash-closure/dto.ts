import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateCashClosureDto {
  @IsString()
  eventId: string;

  @IsNumber()
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
  @IsNumber()
  totalActual: number;

  @IsString()
  @IsOptional()
  notes?: string;
}