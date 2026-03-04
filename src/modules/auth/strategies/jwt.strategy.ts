import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from '@/modules/users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret', 'dev-secret'),
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(payload.sub),
      status: 'active',
      deletedAt: null,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user._id.toString(),
      organizationId: user.organizationId.toString(),
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      accessibleBuildings: user.accessibleBuildings,
    };
  }
}
