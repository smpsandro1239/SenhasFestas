import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  organization?: string;
}

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  organization?: string;
}

export class UpdateEventStatusDto {
  @IsIn(['draft', 'active', 'closed'])
  status: 'draft' | 'active' | 'closed';
}

export class AddMemberDto {
  @IsString()
  userId: string;

  @IsIn(['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer', 'client'])
  role: string;
}

export class EventSettingsDto {
  @IsOptional()
  @IsIn(['EUR', 'USD', 'GBP', 'BRL'])
  currency?: string;

  @IsOptional()
  @IsBoolean()
  allowOffline?: boolean;

  @IsOptional()
  @IsBoolean()
  requireBalance?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceCharge?: number;
}