import { IsEmail, IsString, MinLength, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsIn(['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer'])
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