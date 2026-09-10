import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateCashClosureDto {
  @IsUUID()
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