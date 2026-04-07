import { Body, Controller, Get, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { LocalAuthGuard } from '@/common/guards/local-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResendLoginOtpDto } from './dto/resend-login-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: any, @Body() _dto: LoginDto) {
    return this.authService.startLoginOtp(req.user);
  }

  @Public()
  @Post('verify-login-otp')
  async verifyLoginOtp(@Body() dto: VerifyLoginOtpDto) {
    // new Logger('AuthController').warn(`Verifying OTP with data: ${JSON.stringify(dto)} - Type of OTP: ${typeof dto.otp}`);
    return this.authService.verifyLoginOtp(dto);
  }

  @Public()
  @Post('resend-login-otp')
  async resendLoginOtp(@Body() dto: ResendLoginOtpDto) {
    return this.authService.resendLoginOtp(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.organizationId, dto.userId, dto.refreshToken);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, organizationId, dto);
  }

  @Get('me')
  async me(
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.authService.me(userId, organizationId);
  }
}
