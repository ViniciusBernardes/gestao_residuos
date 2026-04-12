import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExitItemDto {
  @ApiProperty()
  @IsUUID()
  materialId!: string;

  @ApiProperty()
  @IsUUID()
  depositId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateExitDto {
  @ApiProperty({ description: 'UUID do estabelecimento (papel destino final)' })
  @IsUUID()
  establishmentId!: string;

  @ApiProperty({ type: [ExitItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExitItemDto)
  items!: ExitItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
