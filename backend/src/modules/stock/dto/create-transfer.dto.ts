import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty()
  @IsUUID()
  materialId!: string;

  @ApiProperty()
  @IsUUID()
  depositFromId!: string;

  @ApiProperty()
  @IsUUID()
  depositToId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
