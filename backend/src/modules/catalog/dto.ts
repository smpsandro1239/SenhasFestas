import { IsString, IsNumber, IsOptional, IsUUID, IsBoolean, IsArray } from 'class-validator';

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
