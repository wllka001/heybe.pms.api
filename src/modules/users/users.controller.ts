import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { FirstUserBootstrap } from '@/common/decorators/first-user-bootstrap.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.enum';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @FirstUserBootstrap()
  @Permissions(Permission.MANAGE_ORGANIZATIONS)
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.usersService.sanitize(user);
  }

  @Get()
  async findAll(@Req() req: any) {
    const users = await this.usersService.findAll(req.user.organizationId);
    return users.map((user) => this.usersService.sanitize(user));
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    const user = await this.usersService.findById(req.user.organizationId, id);
    return this.usersService.sanitize(user);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(req.user.organizationId, id, dto);
    return this.usersService.sanitize(user);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseObjectIdPipe) id: string) {
    const user = await this.usersService.remove(req.user.organizationId, id);
    return this.usersService.sanitize(user);
  }
}
