import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

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

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsNumber()
  @IsOptional()
  stock?: number;
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
}