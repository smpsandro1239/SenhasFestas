import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  // Segurança (A5/DoS): bcrypt processa apenas os primeiros 72 bytes.
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