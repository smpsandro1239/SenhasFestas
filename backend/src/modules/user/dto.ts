import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  // Limite de 72 caracteres: bcrypt trunca acima de 72 bytes e evita DoS por CPU
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @IsString()
  name: string;

  @IsIn(['organizer', 'cashier', 'bar', 'kitchen', 'treasurer'])
  role: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer', 'client'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}