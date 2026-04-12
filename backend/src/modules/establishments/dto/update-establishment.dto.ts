import { PartialType } from '@nestjs/swagger';
import { CreateEstablishmentDto } from './create-establishment.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEstablishmentDto extends PartialType(CreateEstablishmentDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
