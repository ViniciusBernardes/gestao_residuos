import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstablishmentRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateEstablishmentDto {
  @ApiProperty()
  @IsUUID()
  activityBranchId!: string;

  @ApiProperty({ enum: EstablishmentRole })
  @IsEnum(EstablishmentRole)
  role!: EstablishmentRole;

  @ApiProperty({ description: 'Razão social' })
  @IsString()
  @MinLength(2)
  legalName!: string;

  @ApiProperty({ description: 'Nome comercial' })
  @IsString()
  @MinLength(2)
  tradeName!: string;

  @ApiProperty({ description: 'CNPJ (com ou sem máscara), 14 dígitos' })
  @IsString()
  cnpj!: string;

  @ApiPropertyOptional({ description: 'Inscrição estadual' })
  @IsOptional()
  @IsString()
  stateReg?: string;

  @ApiPropertyOptional({ description: 'Inscrição municipal' })
  @IsOptional()
  @IsString()
  municipalReg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cep?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ufSigla?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ibgeCityCode?: number;

  @ApiPropertyOptional({ description: 'Payload JSON da consulta CNPJ (BrasilAPI)' })
  @IsOptional()
  receitaPayload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalRepFullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalRepCpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  legalRepEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalRepPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  legacyAddress?: string;
}
