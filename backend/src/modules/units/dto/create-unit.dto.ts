import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'KG' })
  @IsString()
  @Length(1, 16)
  code!: string;

  @ApiProperty({ example: 'Quilograma' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
