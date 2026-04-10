import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({
      organizationId: new Types.ObjectId(dto.organizationId),
      email: dto.email.toLowerCase(),
      deletedAt: null,
    });

    if (existing) {
      throw new ConflictException('User email already exists in this organization.');
    }

    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    return this.userModel.create({
      organizationId: new Types.ObjectId(dto.organizationId),
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      permissions: dto.permissions ?? [],
      accessibleBuildings: (dto.accessibleBuildings ?? []).map(
        (id) => new Types.ObjectId(id),
      ),
      status: 'active',
      security: {
        passwordChangedAt: new Date(),
      },
    });
  }

  async findAll(organizationId: string): Promise<UserDocument[]> {
    return this.userModel
      .find({ organizationId: new Types.ObjectId(organizationId), deletedAt: null })
      .sort({ createdAt: -1 });
  }

  async findById(organizationId: string, id: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: null,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async findByEmail( email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      email: email.toLowerCase(),
      deletedAt: null,
    });
  }

  async findByIdentifier(identifier: string): Promise<UserDocument | null> {
    const normalized = identifier.toLowerCase().trim();
    return this.userModel.findOne({
      $or: [{ email: normalized }, { username: normalized }],
      deletedAt: null,
    });
  }

  async findByEmailGlobal(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase(), deletedAt: null });
  }

  async hasAnyActiveUser(): Promise<boolean> {
    const total = await this.userModel.countDocuments({ deletedAt: null });
    return total > 0;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserDocument> {
    const updatePayload: Record<string, unknown> = {
      ...dto,
    };

    if (dto.accessibleBuildings) {
      updatePayload.accessibleBuildings = dto.accessibleBuildings.map(
        (buildingId) => new Types.ObjectId(buildingId),
      );
    }

    if (dto.password) {
      const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
      updatePayload.passwordHash = await bcrypt.hash(dto.password, rounds);
      updatePayload['security.passwordChangedAt'] = new Date();
      delete updatePayload.password;
    }

    const user = await this.userModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      updatePayload,
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async remove(organizationId: string, id: string): Promise<UserDocument> {
    const user = await this.userModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
      },
      { deletedAt: new Date(), status: 'inactive' },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  sanitize(user: UserDocument): Record<string, unknown> {
    return {
      id: user._id.toString(),
      organizationId: user.organizationId.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions,
      accessibleBuildings: user.accessibleBuildings?.map((id) => id.toString()) ?? [],
      status: user.status,
    };
  }
}
