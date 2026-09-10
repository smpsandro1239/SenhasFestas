import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
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