import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsIn(['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer', 'client'])
  role: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
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
  isActive?: boolean;
}