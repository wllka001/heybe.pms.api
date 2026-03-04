import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { LocalAuthGuard } from '@/common/guards/local-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: any, @Body() _dto: LoginDto) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.organizationId, dto.userId, dto.refreshToken);
  }

  @Get('me')
  async me(
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.authService.me(userId, organizationId);
  }
}
