import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        active: true,
      },
      include: { permissionProfile: { select: { fullAccess: true } } },
    });
    if (!user) throw new UnauthorizedException();
    return {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      permissionProfileId: user.permissionProfileId,
      fullAccess: user.permissionProfile?.fullAccess ?? false,
    };
  }
}
