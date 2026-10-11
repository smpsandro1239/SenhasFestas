import { IsString, IsNumber, IsOptional, IsUUID, IsBoolean, IsArray, Min, MaxLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsUUID()
  @IsOptional()
  eventId?: string;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  availability?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsNumber()
  @IsOptional()
  stock?: number;

  @IsString()
  @IsOptional()
  kitchenName?: string;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  availability?: string;

  @IsNumber()
  @IsOptional()
  stock?: number;

  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  kitchenName?: string | null;
}

export class AdjustStockDto {
  @IsNumber()
  @IsOptional()
  delta?: number;

  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  @IsOptional()
  novoValor?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  motivo?: string;
}

export class ImportProductsDto {
  @IsUUID()
  sourceEventId: string;

  @IsUUID()
  targetEventId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  productIds?: string[];
}
