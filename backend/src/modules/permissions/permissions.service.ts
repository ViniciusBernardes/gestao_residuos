import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PERMISSION_MODULES,
  PERMISSION_MODULE_KEYS,
  PermissionCell,
  PermissionsMatrix,
  emptyMatrix,
  fullMatrix,
} from '../../common/permissions/permission-modules';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  moduleDefinitions() {
    return PERMISSION_MODULES.map(({ key, label }) => ({ key, label }));
  }

  sanitizePermissionsJson(raw: unknown): PermissionsMatrix {
    const base = emptyMatrix();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
    const o = raw as Record<string, unknown>;
    for (const key of PERMISSION_MODULE_KEYS) {
      const cell = o[key];
      if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
        const c = cell as Record<string, unknown>;
        base[key] = {
          view: !!c.view,
          edit: !!c.edit,
        };
      }
    }
    return base;
  }

  effectiveMatrixForProfile(profile: {
    fullAccess: boolean;
    permissions: unknown;
  }): PermissionsMatrix {
    if (profile.fullAccess) return fullMatrix();
    return this.sanitizePermissionsJson(profile.permissions);
  }

  async effectiveMatrix(tenantId: string, permissionProfileId: string): Promise<PermissionsMatrix> {
    const profile = await this.prisma.permissionProfile.findFirst({
      where: { id: permissionProfileId, tenantId, active: true },
    });
    if (!profile) return emptyMatrix();
    return this.effectiveMatrixForProfile(profile);
  }

  async canProfileGrant(
    tenantId: string,
    userId: string,
    moduleKey: string,
    level: 'view' | 'edit',
  ): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, active: true },
      include: { permissionProfile: { select: { fullAccess: true, permissions: true } } },
    });
    if (!user?.permissionProfile) return false;

    const matrix = this.effectiveMatrixForProfile(user.permissionProfile);
    const cell: PermissionCell | undefined = matrix[moduleKey];
    if (!cell) return false;
    return level === 'view' ? cell.view : cell.edit;
  }

  async userHasFullAccess(tenantId: string, userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, active: true },
      include: { permissionProfile: { select: { fullAccess: true } } },
    });
    return !!user?.permissionProfile?.fullAccess;
  }
}
