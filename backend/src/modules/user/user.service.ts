import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, ILike, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity, EventUserEntity } from '../../entities';
import { CreateUserDto, UpdateUserDto } from './dto';
import { MembershipService } from '../../common/membership.service';
import { PUBLIC_USER_SELECT, PUBLIC_USER_SELECT_COM_ACCESS_CODE, toPublicUser } from '../../common/serializers';
import { codigoAcessoUnico } from '../../common/access-code';
import { SnapshotAuditoria } from '../../common/interceptors/audit.interceptor';

const SEM_MEMBROS = '00000000-0000-0000-0000-000000000000';

const CAMPOS_PUBLICOS = PUBLIC_USER_SELECT;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(EventUserEntity)
    private readonly eventUserRepository: Repository<EventUserEntity>,
    private readonly membershipService: MembershipService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private async idsDeMembros(eventoIds: string[]): Promise<string[]> {
    const membros = await this.eventUserRepository.find({
      where: { event: { id: In(eventoIds) } },
      select: { user: { id: true } },
      relations: { user: true },
    });
    return membros.map((m) => m.user?.id).filter((id): id is string => Boolean(id));
  }

  async findAll(utilizador?: any, q?: string): Promise<Partial<UserEntity>[]> {
    const scope = await this.membershipService.eventIdsFor(utilizador);
    const search = q
      ? [
          { name: ILike(`%${q}%`) },
          { email: ILike(`%${q}%`) },
        ]
      : undefined;
    if (scope === null) {
      if (!search) {
        return this.userRepository.find({ select: CAMPOS_PUBLICOS, order: { name: 'ASC' } });
      }
      return this.userRepository.find({
        where: search,
        select: CAMPOS_PUBLICOS,
        order: { name: 'ASC' },
      });
    }
    if (scope.length === 0) {
      return [];
    }
    const ids = await this.idsDeMembros(scope);
    const filter = ids.length ? { id: In(ids) } : { id: SEM_MEMBROS };
    const where = search
      ? search.map((s) => ({ ...filter, ...s }))
      : (filter as any);
    return this.userRepository.find({
      where,
      select: CAMPOS_PUBLICOS as any,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, utilizador?: any): Promise<Partial<UserEntity>> {
    return this.dataSource.transaction(async (manager) => {
      let eventIds: string[] | null = null;
      if (utilizador?.id && utilizador.role !== 'superadmin') {
        // Bloqueia as memberships do operador e do utilizador consultado até ao fim
        // da leitura, impedindo que uma revogação intercale a autorização.
        const memberships = await manager.find(EventUserEntity, {
          where: { user: { id: utilizador.id } },
          select: { event: { id: true } },
          relations: { event: true },
          lock: { mode: 'pessimistic_read' },
        });
        eventIds = memberships
          .map((membership) => membership.event?.id)
          .filter((eventId): eventId is string => Boolean(eventId));
      }

      const user = await manager.findOne(UserEntity, {
        where: { id },
        select: CAMPOS_PUBLICOS as any,
      });
      if (!user) {
        throw new NotFoundException('Utilizador não encontrado');
      }

      if (eventIds !== null) {
        if (eventIds.length === 0) {
          throw new NotFoundException('Utilizador não encontrado');
        }
        const membership = await manager.findOne(EventUserEntity, {
          where: { event: { id: In(eventIds) }, user: { id } },
          lock: { mode: 'pessimistic_read' },
        });
        if (!membership) {
          throw new NotFoundException('Utilizador não encontrado');
        }
      }
      return user;
    });
  }

  async findByAccessCode(code: string, utilizador?: any): Promise<Partial<UserEntity>> {
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Código de acesso inválido');
    }
    const user = await this.userRepository.findOne({
      where: { accessCode: code },
      select: PUBLIC_USER_SELECT_COM_ACCESS_CODE as any,
    });
    if (!user) {
      throw new NotFoundException('Nenhum cliente encontrado com esse código.');
    }
    const scope = await this.membershipService.eventIdsFor(utilizador);
    if (scope !== null) {
      const ids = scope.length > 0 ? await this.idsDeMembros(scope) : [];
      if (!ids.includes(user.id)) {
        throw new NotFoundException('Nenhum cliente encontrado com esse código.');
      }
    }
    return user;
  }

  async create(dto: CreateUserDto, actor?: UserEntity): Promise<Partial<UserEntity>> {
    // Autorização de campo: criar superadmin é exclusivo de um superadmin (defesa em
    // profundidade — o DTO já rejeita o valor; esta cláusula protege futuros alargamentos).
    if (dto.role === 'superadmin' && actor?.role !== 'superadmin') {
      throw new ForbiddenException('Apenas um superadmin pode criar outro superadmin');
    }
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
      accessCode: await codigoAcessoUnico(async (c) =>
        Boolean(await this.userRepository.findOne({ where: { accessCode: c } })),
      ),
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);
    return toPublicUser(savedUser) as Partial<UserEntity>;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<Partial<UserEntity>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }
    arquivar?.({ antes: toPublicUser(user) });
    Object.assign(user, dto);
    const savedUser = await this.userRepository.save(user);
    return toPublicUser(savedUser) as Partial<UserEntity>;
  }

  async remove(
    id: string,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<{ deleted: boolean; softDelete: boolean }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }
    arquivar?.({ antes: toPublicUser(user) });
    await this.userRepository.softDelete(id);
    return { deleted: true, softDelete: true };
  }
}