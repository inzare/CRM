import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenGuard } from './access-token.guard';
import { AuthController, MeController } from './auth.controller';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { PasswordService } from './password.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, MeController],
  providers: [AuthService, PasswordService, NotificationService, AccessTokenGuard, RolesGuard],
  exports: [
    AuthService,
    PasswordService,
    NotificationService,
    AccessTokenGuard,
    RolesGuard,
    JwtModule,
  ],
})
export class AuthModule {}
