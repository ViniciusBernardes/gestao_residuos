import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login JWT (informar tenantSlug do município)' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip ?? req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.auth.login(dto, ip, typeof userAgent === 'string' ? userAgent : undefined);
  }
}
