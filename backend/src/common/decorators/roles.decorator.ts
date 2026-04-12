import { SetMetadata } from '@nestjs/common';
import { RouteRole } from '../constants/route-role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RouteRole[]) => SetMetadata(ROLES_KEY, roles);
