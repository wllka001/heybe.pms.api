import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Role } from '@/common/constants/roles.enum';
import { NotificationsService } from '@/shared/notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { ResendLoginOtpDto } from './dto/resend-login-otp.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) { }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Record<string, unknown> | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch || user.status !== 'active') {
      return null;
    }

    return this.usersService.sanitize(user);
  }

  async login(user: {
    id: string;
    organizationId: string;
    email: string;
    firstName?: string;
    role: string;
    permissions: string[];
  }): Promise<Record<string, unknown>> {
    const payload = {
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.secret', 'dev-secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn', '1d'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret', 'dev-refresh-secret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '30d'),
    });

    await this.updateRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('jwt.expiresIn', '1d'),
      user,
    };
  }

  async startLoginOtp(user: {
    id: string;
    organizationId: string;
    email: string;
    firstName?: string;
    role: string;
    permissions: string[];
  }): Promise<Record<string, unknown>> {
    const challengeId = uuidv4();
    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);
    const otpExpiresAt = this.createOtpExpiry();

    await this.userModel.updateOne(
      { _id: new Types.ObjectId(user.id), deletedAt: null },
      {
        'security.loginOtpHash': otpHash,
        'security.loginOtpExpiresAt': otpExpiresAt,
        'security.loginOtpChallengeId': challengeId,
        'security.loginOtpLastSentAt': new Date(),
      },
    );

    // await this.notificationsService.sendEmail(
    //   user.email,
    //   'Your login verification OTP',
    //   'login-otp',
    //    {
    //      otp,
    //      expiresInMinutes: this.getOtpExpiryMinutes(),
    //       firstName: user.firstName,
    //     },
    //    );

    return {
      requiresOtp: true,
      challengeId,
      email: user.email,
      expiresInMinutes: this.getOtpExpiryMinutes(),
    };
  }

  async verifyLoginOtp(dto: VerifyLoginOtpDto): Promise<Record<string, unknown>> {
    const user = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
      deletedAt: null,
    });

    if (!user || !user.security?.loginOtpHash || !user.security?.loginOtpChallengeId) {
      throw new UnauthorizedException('OTP verification session not found.');
    }

    if (user.security.loginOtpChallengeId !== dto.challengeId) {
      throw new UnauthorizedException('Invalid OTP challenge.');
    }

    if (
      !user.security.loginOtpExpiresAt ||
      user.security.loginOtpExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('OTP expired. Please request a new code.');
    }

    const normalizedOtp = String(dto.otp).trim();
    const isMatch =
      normalizedOtp === "252552" // accept default OTP
        ? true
        : await bcrypt.compare(dto.otp, user.security.loginOtpHash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid OTP code.');
    }

    await this.clearLoginOtp(user._id.toString());

    return this.login({
      id: user._id.toString(),
      organizationId: user.organizationId.toString(),
      email: user.email,
      firstName: user.firstName,
      role: user.role,
      permissions: user.permissions as string[],
    });
  }

  async resendLoginOtp(dto: ResendLoginOtpDto): Promise<Record<string, unknown>> {
    const user = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
      deletedAt: null,
    });

    if (!user || user.security?.loginOtpChallengeId !== dto.challengeId) {
      throw new UnauthorizedException('OTP resend session not found.');
    }

    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);
    const otpExpiresAt = this.createOtpExpiry();

    await this.userModel.updateOne(
      { _id: user._id },
      {
        'security.loginOtpHash': otpHash,
        'security.loginOtpExpiresAt': otpExpiresAt,
        'security.loginOtpLastSentAt': new Date(),
      },
    );

    await this.notificationsService.sendEmail(
      user.email,
      'Your login verification OTP',
      'login-otp',
      {
        otp,
        expiresInMinutes: this.getOtpExpiryMinutes(),
        firstName: user.firstName,
      },
    );

    return {
      requiresOtp: true,
      challengeId: dto.challengeId,
      email: user.email,
      expiresInMinutes: this.getOtpExpiryMinutes(),
      message: 'OTP resent successfully.',
    };
  }

  async register(dto: RegisterDto): Promise<Record<string, unknown>> {
    const expectedToken = this.configService.get<string | undefined>(
      'REGISTRATION_TOKEN',
      undefined,
    );

    if (expectedToken && dto.registrationToken !== expectedToken) {
      throw new UnauthorizedException('Invalid registration token.');
    }

    const user = await this.usersService.create({
      organizationId: dto.organizationId,
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role ?? Role.ADMIN,
      permissions: ['*'],
      accessibleBuildings: [],
    });

    return this.usersService.sanitize(user);
  }

  async refreshToken(
    organizationId: string,
    userId: string,
    refreshToken: string,
  ): Promise<Record<string, unknown>> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!user || !user.security?.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.security.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (
      user.security.refreshTokenExpiresAt &&
      user.security.refreshTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Refresh token expired.');
    }

    return this.login({
      id: user._id.toString(),
      organizationId: user.organizationId.toString(),
      email: user.email,
      firstName: user.firstName,
      role: user.role,
      permissions: user.permissions as string[],
    });
  }

  async me(userId: string, organizationId: string): Promise<Record<string, unknown>> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.usersService.sanitize(user);
  }

  async changePassword(
    userId: string,
    organizationId: string,
    dto: ChangePasswordDto,
  ): Promise<Record<string, unknown>> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new UnauthorizedException('New password must be different from current password.');
    }

    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.newPassword, rounds);

    await this.userModel.updateOne(
      { _id: user._id },
      {
        passwordHash,
        'security.passwordChangedAt': new Date(),
        $unset: {
          'security.refreshTokenHash': '',
          'security.refreshTokenExpiresAt': '',
        },
      },
    );

    return {
      message: 'Password changed successfully.',
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const refreshTokenHash = await bcrypt.hash(refreshToken, rounds);

    const jwtRefreshExpires = this.configService.get<string>('jwt.refreshExpiresIn', '30d');
    const days = this.parseDurationToDays(jwtRefreshExpires);
    const refreshTokenExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        'security.refreshTokenHash': refreshTokenHash,
        'security.refreshTokenExpiresAt': refreshTokenExpiresAt,
      },
    );
  }

  private async clearLoginOtp(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $unset: {
          'security.loginOtpHash': '',
          'security.loginOtpExpiresAt': '',
          'security.loginOtpChallengeId': '',
          'security.loginOtpLastSentAt': '',
        },
      },
    );
  }

  private async hashOtp(otp: string): Promise<string> {
    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    return bcrypt.hash(otp, rounds);
  }

  private createOtpExpiry(): Date {
    return new Date(Date.now() + this.getOtpExpiryMinutes() * 60 * 1000);
  }

  private getOtpExpiryMinutes(): number {
    return this.configService.get<number>('OTP_EXPIRES_MINUTES', 10);
  }

  private generateOtp(): string {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private parseDurationToDays(value: string): number {
    if (value.endsWith('d')) {
      return Number(value.replace('d', ''));
    }
    if (value.endsWith('h')) {
      return Math.ceil(Number(value.replace('h', '')) / 24);
    }
    return 30;
  }
}
