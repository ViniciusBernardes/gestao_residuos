import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstablishmentRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateActivityBranchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ enum: EstablishmentRole })
  @IsOptional()
  @IsEnum(EstablishmentRole)
  role?: EstablishmentRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
