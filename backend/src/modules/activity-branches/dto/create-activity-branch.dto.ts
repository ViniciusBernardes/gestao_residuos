import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstablishmentRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateActivityBranchDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: EstablishmentRole })
  @IsEnum(EstablishmentRole)
  role!: EstablishmentRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
