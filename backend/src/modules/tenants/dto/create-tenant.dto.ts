import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Município Novo' })
  @IsString()
  @MinLength(2)
  @MaxLength(256)
  name!: string;

  @ApiProperty({ example: 'municipio-novo' })
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug: apenas minúsculas, números e hífens (sem hífen no início ou fim)',
  })
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;
}
