import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn, IsBoolean, IsByteLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  // Passwords novas: mínimo 12 caracteres; bcrypt aceita no máximo 72 bytes.
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @IsByteLength(1, 72)
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