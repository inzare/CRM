import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';

import { requestIdOf } from '../common/request-id.middleware';
import type { Environment } from '../config/environment';

import { AccessTokenGuard } from './access-token.guard';
import {
  ChangePasswordDto,
  AcceptInvitationDto,
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  UpdateProfileDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import type { RequestMetadata } from './auth.types';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';

const REFRESH_COOKIE = 'consultflow_refresh';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Authenticate with email and password' })
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input.email, input.password, this.metadata(request));
    this.setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate refresh session and issue access token' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = this.readRefreshCookie(request);
    const result = await this.auth.refresh(token, this.metadata(request));
    this.setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh session' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(this.readRefreshCookie(request, false), this.metadata(request));
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Request a password reset without account disclosure' })
  async requestReset(@Body() input: PasswordResetRequestDto, @Req() request: Request) {
    await this.auth.requestPasswordReset(input.email, this.metadata(request));
    return { message: 'If the account is eligible, reset instructions will be sent.' };
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Consume a single-use password reset token' })
  async confirmReset(
    @Body() input: PasswordResetConfirmDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.confirmPasswordReset(input.token, input.password, this.metadata(request));
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Accept a single-use user invitation' })
  acceptInvitation(@Body() input: AcceptInvitationDto, @Req() request: Request): Promise<void> {
    return this.auth.acceptInvitation(input.token, input.password, this.metadata(request));
  }

  private setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  private readRefreshCookie(request: Request, required = true): string {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[REFRESH_COOKIE];
    if (typeof token === 'string' && token.length >= 32) return token;
    if (!required) return '';
    return 'missing';
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/api/v1/auth',
    };
  }

  private metadata(request: Request): RequestMetadata {
    const userAgent = request.header('user-agent');
    return {
      requestId: requestIdOf(request),
      ...(request.ip ? { ipAddress: request.ip } : {}),
      ...(userAgent ? { userAgent } : {}),
    };
  }
}

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('me')
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Patch()
  @ApiOperation({ summary: 'Update the signed-in user profile' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateProfileDto,
    @Req() request: Request,
  ): Promise<AuthenticatedUser> {
    return this.auth.updateProfile(user.id, input.name, this.metadata(request));
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change the signed-in user password' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    return this.auth.changePassword(
      user.id,
      input.currentPassword,
      input.newPassword,
      this.metadata(request),
    );
  }

  private metadata(request: Request): RequestMetadata {
    const userAgent = request.header('user-agent');
    return {
      requestId: requestIdOf(request),
      ...(request.ip ? { ipAddress: request.ip } : {}),
      ...(userAgent ? { userAgent } : {}),
    };
  }
}
