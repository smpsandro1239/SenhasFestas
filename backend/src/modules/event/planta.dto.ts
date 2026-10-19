import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const MAX_ZONAS_PLANTA = 100;

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

  // Graus inteiros. Opcional: plantas antigas não o têm e assume-se 0.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(359)
  rotacao?: number;
}

export class ZonaPlantaDto {
  @IsString()
  @MaxLength(120)
  id: string;

  @IsString()
  @MaxLength(60)
  nome: string;

  @IsString()
  @MaxLength(20)
  cor: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;

  // Zonas degeneradas (w/h = 0) não têm área: rejeitam-se no DTO. O serviço
  // faz clamp de x+w<=100 e y+h<=100 (geometria, não formato).
  @IsNumber()
  @Min(1)
  @Max(100)
  w: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  h: number;
}

export class DimensoesPlantaDto {
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(200)
  larguraM: number;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(200)
  alturaM: number;
}

export class GuardarPlantaDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MesaPlantaDto)
  mesas: MesaPlantaDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ZONAS_PLANTA)
  @ValidateNested({ each: true })
  @Type(() => ZonaPlantaDto)
  zonas?: ZonaPlantaDto[] = [];

  @IsOptional()
  @ValidateNested()
  @Type(() => DimensoesPlantaDto)
  dimensoes?: DimensoesPlantaDto;

  @IsInt()
  @Min(0)
  version: number;
}
