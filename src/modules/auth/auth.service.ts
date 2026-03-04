import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Role } from '@/common/constants/roles.enum';
import { UsersService } from '@/modules/users/users.service';
import { User, UserDocument } from '@/modules/users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
