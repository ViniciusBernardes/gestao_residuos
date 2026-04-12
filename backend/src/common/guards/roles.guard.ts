import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RouteRole } from '../constants/route-role.enum';
import { JwtUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { resolveRoutePermission } from '../permissions/route-permission.map';
import { PermissionsService } from '../../modules/permissions/permissions.service';

function isAdminOnlyRoles(required: RouteRole[]): boolean {
  return required.length > 0 && required.every((r) => r === RouteRole.ADMIN);
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RouteRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as JwtUser | undefined;
    if (!user) throw new ForbiddenException();

    if (user.fullAccess) return true;

    if (isAdminOnlyRoles(required)) {
      throw new ForbiddenException('Perfil sem permissão para esta operação');
    }

    const url = req.originalUrl ?? req.url ?? '';
    const perm = resolveRoutePermission(req.method, url);
    if (perm) {
      const granted = await this.permissions.canProfileGrant(
        user.tenantId,
        user.sub,
        perm.key,
        perm.level,
      );
      if (granted) return true;
    }

    throw new ForbiddenException('Perfil sem permissão para esta operação');
  }
}
