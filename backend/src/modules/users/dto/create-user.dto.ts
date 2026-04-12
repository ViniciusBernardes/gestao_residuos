import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'UUID do perfil de permissões (obrigatório)' })
  @IsUUID()
  permissionProfileId!: string;
}
