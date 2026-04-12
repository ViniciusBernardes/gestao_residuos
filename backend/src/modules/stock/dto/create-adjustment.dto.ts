import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAdjustmentDto {
  @ApiProperty()
  @IsUUID()
  materialId!: string;

  @ApiProperty()
  @IsUUID()
  depositId!: string;

  /** Positivo aumenta estoque; negativo reduz (ajuste de inventário). */
  @ApiProperty({ description: 'Variação na quantidade (pode ser negativa)' })
  @Type(() => Number)
  @IsNumber()
  quantityDelta!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
