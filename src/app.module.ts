import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import { envValidationSchema } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { OrganizationGuard } from './common/guards/organization.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { LeasesModule } from './modules/leases/leases.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UnitsModule } from './modules/units/units.module';
import { UtilityUsageModule } from './modules/utility-usage/utility-usage.module';
import { UsersModule } from './modules/users/users.module';
import { DatabaseModule } from './shared/database/database.module';
import { FileUploadModule } from './shared/file-upload/file-upload.module';
import { NotificationsModule } from './shared/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, jwtConfig],
      validationSchema: envValidationSchema,
      expandVariables: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
    }),
    DatabaseModule,
    FileUploadModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    BuildingsModule,
    UnitsModule,
    UtilityUsageModule,
    TenantsModule,
    LeasesModule,
    MaintenanceModule,
    EmployeesModule,
    PayrollModule,
    FinanceModule,
    ReportsModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrganizationGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
