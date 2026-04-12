import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
  ) {}

  async validateUser(dto: LoginDto, ip?: string, userAgent?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant?.active) {
      await this.logLogin(null, null, dto.email, false, 'Tenant inválido', ip, userAgent);
      throw new UnauthorizedException('Município não encontrado ou inativo');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email: dto.email.toLowerCase() },
      },
      include: { permissionProfile: { select: { fullAccess: true } } },
    });

    if (!user?.active) {
      await this.logLogin(tenant.id, null, dto.email, false, 'Usuário inválido', ip, userAgent);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      await this.logLogin(tenant.id, user.id, dto.email, false, 'Senha incorreta', ip, userAgent);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.logLogin(tenant.id, user.id, dto.email, true, undefined, ip, userAgent);

    return user;
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.validateUser(dto, ip, userAgent);
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const permissions = await this.permissions.effectiveMatrix(
      user.tenantId,
      user.permissionProfileId,
    );
    const fullAccess = user.permissionProfile?.fullAccess ?? false;
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES ?? '8h',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        permissionProfileId: user.permissionProfileId,
        fullAccess,
        permissions,
      },
    };
  }

  private async logLogin(
    tenantId: string | null,
    userId: string | null,
    email: string,
    success: boolean,
    reason: string | undefined,
    ip?: string,
    userAgent?: string,
  ) {
    await this.prisma.loginAuditLog.create({
      data: {
        tenantId: tenantId ?? undefined,
        userId: userId ?? undefined,
        email,
        success,
        reason,
        ip,
        userAgent,
      },
    });
  }
}
