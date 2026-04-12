import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePermissionProfileDto {
  @ApiProperty({ maxLength: 128 })
  @IsString()
  @MaxLength(128)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  /** Se true, ignora a matriz e libera todo o sistema (só quem já tem acesso total pode criar). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fullAccess?: boolean;

  /** Matriz: { [moduleKey]: { view, edit } } — ignorada quando fullAccess é true */
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  permissions!: Record<string, { view: boolean; edit: boolean }>;
}
