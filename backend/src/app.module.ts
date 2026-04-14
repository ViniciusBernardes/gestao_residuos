import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { MaterialTypesModule } from './modules/material-types/material-types.module';
import { UnitsModule } from './modules/units/units.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { EstablishmentsModule } from './modules/establishments/establishments.module';
import { ActivityBranchesModule } from './modules/activity-branches/activity-branches.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { StockModule } from './modules/stock/stock.module';
import { ExitsModule } from './modules/exits/exits.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ImportModule } from './modules/import/import.module';
import { AuditModule } from './modules/audit/audit.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PermissionProfilesModule } from './modules/permission-profiles/permission-profiles.module';
import { BackupModule } from './modules/backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 200,
      },
    ]),
    PrismaModule,
    PermissionsModule,
    PermissionProfilesModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    MaterialTypesModule,
    UnitsModule,
    MaterialsModule,
    EstablishmentsModule,
    ActivityBranchesModule,
    IntegrationsModule,
    StockModule,
    ExitsModule,
    TrackingModule,
    ReportsModule,
    ImportModule,
    AuditModule,
    AdminModule,
    BackupModule,
    HealthModule,
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
