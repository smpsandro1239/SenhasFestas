import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class MesaPlantaDto {
  @IsString()
  @MaxLength(120)
  id: string;

  @IsString()
  @MaxLength(60)
  nome: string;

  @IsInt()
  @Min(0)
  @Max(99)
  lugares: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;

  @IsIn(['redonda', 'quadrada'])
  forma: 'redonda' | 'quadrada';
}

export class GuardarPlantaDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MesaPlantaDto)
  mesas: MesaPlantaDto[];

  @IsInt()
  @Min(0)
  version: number;
}
