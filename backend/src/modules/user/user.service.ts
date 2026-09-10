import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity, EventUserEntity } from '../../entities';
import { CreateUserDto, UpdateUserDto } from './dto';
import { MembershipService } from '../../common/membership.service';

const SEM_MEMBROS = '00000000-0000-0000-0000-000000000000';

const CAMPOS_PUBLICOS = {
  id: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
    private readonly membershipService: MembershipService,
  ) {}

  private async idsDeMembros(eventoIds: string[]): Promise<string[]> {
    const membros = await this.eventUserRepository.find({
      where: { event: { id: In(eventoIds) } },
      select: { user: { id: true } },
      relations: { user: true },
    });
    return membros.map((m) => m.user?.id).filter((id): id is string => Boolean(id));
  }

  async findAll(utilizador?: any): Promise<Partial<UserEntity>[]> {
    const scope = await this.membershipService.eventIdsFor(utilizador);
    if (scope === null) {
      return this.userRepository.find({ select: CAMPOS_PUBLICOS });
    }
    if (scope.length === 0) {
      return [];
    }
    const ids = await this.idsDeMembros(scope);
    return this.userRepository.find({
      where: ids.length ? { id: In(ids) } : { id: SEM_MEMBROS },
      select: CAMPOS_PUBLICOS as any,
    });
  }

  async findOne(id: string, utilizador?: any): Promise<Partial<UserEntity>> {
    const scope = await this.membershipService.eventIdsFor(utilizador);
    const user = await this.userRepository.findOne({
      where: { id },
      select: CAMPOS_PUBLICOS as any,
    });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }
    if (scope !== null) {
      const ids = scope.length > 0 ? await this.idsDeMembros(scope) : [];
      if (!ids.includes(id)) {
        throw new NotFoundException('Utilizador não encontrado');
      }
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<Partial<UserEntity>> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email já em uso');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      role: dto.role,
      phone: dto.phone,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);
    const { password: _password, ...safe } = savedUser;
    return safe;
  }

  async update(id: string, dto: UpdateUserDto): Promise<Partial<UserEntity>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }
    Object.assign(user, dto);
    const savedUser = await this.userRepository.save(user);
    return {
      id: savedUser.id,
      email: savedUser.email,
      name: savedUser.name,
      role: savedUser.role,
      phone: savedUser.phone,
      isActive: savedUser.isActive,
      createdAt: savedUser.createdAt,
      updatedAt: savedUser.updatedAt,
    };
  }

  async remove(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }
    await this.userRepository.remove(user);
  }
}