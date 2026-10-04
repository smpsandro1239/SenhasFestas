import { IsString, IsNumber, IsOptional, IsUUID, IsBoolean } from 'class-validator';

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

  // Nome que a cozinha lê, quando difere do nome de menu. Precisa de @IsString
  // para não entrar um number e o KDS mostrar "42".
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

  // null limpa: um produto que deixou de ter nome próprio na cozinha volta ao
  // nome de menu.
  @IsString()
  @IsOptional()
  kitchenName?: string | null;
}