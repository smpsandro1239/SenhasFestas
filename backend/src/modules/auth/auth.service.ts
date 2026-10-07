import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, IsNull, Brackets } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserEntity, RefreshTokenEntity } from '../../entities';
import { toPublicUser } from '../../common/serializers';
import { codigoAcessoUnico } from '../../common/access-code';
import { EventService } from '../event/event.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthResult {
  token: string;
  refreshToken: string;
  user: Partial<UserEntity>;
}

const REFRESH_TTL_DAYS = 30;

// Comparação dummy para o login nunca distinguir "email existe" pelo tempo de resposta.
const DUMMY_HASH = bcrypt.hashSync('senhasfestas-dummy-placeholder', 10);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
    private readonly eventService: EventService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private signAccessToken(user: UserEntity): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload, {
      issuer: 'senhasfestas-api',
      audience: 'senhasfestas-app',
    });
  }

  private async emitRefreshToken(userId: string): Promise<string> {
    const raw = crypto.randomBytes(48).toString('base64url');
    const token = this.refreshTokenRepository.create({
      userId,
      tokenHash: this.hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    });
    await this.refreshTokenRepository.save(token);
    return raw;
  }

  private sanitizeUser(user: UserEntity): Partial<UserEntity> {
    return (toPublicUser(user) ?? {}) as Partial<UserEntity>;
  }

  private async assertUserActive(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilizador inválido ou inativo');
    }
    return user;
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.userRepository.findOne({ where: { email } });
    const hash = user ? user.password : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(password, hash);

    if (!user || !user.isActive || !isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const token = this.signAccessToken(user);
    const refreshToken = await this.emitRefreshToken(user.id);

    return {
      token,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  private async seguirCadeiaRotacao(stored: RefreshTokenEntity): Promise<RefreshTokenEntity> {
    let atual = stored;
    const visitados = new Set<string>();
    while (atual.revokedAt || atual.isUsed) {
      if (visitados.has(atual.id)) {
        break;
      }
      visitados.add(atual.id);
      const sucessor = await this.refreshTokenRepository.findOne({
        where: { replacedByTokenId: atual.id },
      });
      if (!sucessor) {
        break;
      }
      atual = sucessor;
    }
    return atual;
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token inválido');
    }
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });
    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Tolerar rotação em andamento: se o token do cookie já foi substituído
    // (corrida entre abas/intervalo/401 simultâneos), avança para o sucessor
    // ativo em vez de devolver 401 para sempre e deixar a sessão presa.
    const ativo = await this.seguirCadeiaRotacao(stored);
    if (ativo.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expirado ou já utilizado');
    }

    const user = await this.assertUserActive(ativo.userId);

    const revoked = await this.refreshTokenRepository.update(
      { id: ativo.id, revokedAt: IsNull(), isUsed: false },
      { revokedAt: new Date(), isUsed: true },
    );
    if (!revoked.affected) {
      throw new UnauthorizedException('Refresh token já utilizado');
    }

    const raw = await this.emitRefreshToken(user.id);
    const newHash = this.hashToken(raw);
    await this.refreshTokenRepository.update(
      { userId: user.id, tokenHash: newHash },
      { replacedByTokenId: ativo.id },
    );

    const token = this.signAccessToken(user);
    return {
      token,
      refreshToken: raw,
      user: this.sanitizeUser(user),
    };
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    if (!refreshToken) {
      return { success: true };
    }
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findOne({ where: { tokenHash } });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      stored.isUsed = true;
      await this.refreshTokenRepository.save(stored);
    }
    return { success: true };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), isUsed: true },
    );
  }

  async register(
    email: string,
    password: string,
    name: string,
    role: string,
    phone?: string,
    eventCode?: string,
  ): Promise<AuthResult> {
    let evento: { id: string } | null = null;
    if (eventCode !== undefined && eventCode !== null) {
      try {
        evento = await this.eventService.findByCode(eventCode);
      } catch (erro) {
        if (erro instanceof NotFoundException) {
          throw new BadRequestException('Código de evento inválido');
        }
        throw erro;
      }
    }

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email já em uso');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      role: 'client',
      phone,
      accessCode: await codigoAcessoUnico(async (c) =>
        Boolean(await this.userRepository.findOne({ where: { accessCode: c } })),
      ),
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    if (evento) {
      await this.eventService.vincularCliente(savedUser.id, evento.id);
    }

    const token = this.signAccessToken(savedUser);
    const refreshToken = await this.emitRefreshToken(savedUser.id);

    return {
      token,
      refreshToken,
      user: this.sanitizeUser(savedUser),
    };
  }

  async entrar(
    user: UserEntity,
    eventCode: string,
    replace: boolean,
  ): Promise<{ eventId: string; eventName: string; replaces: number }> {
    return this.eventService.entrar(user.id, eventCode, replace);
  }

  async validateUser(payload: JwtPayload): Promise<UserEntity> {
    return this.assertUserActive(payload.sub);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens(): Promise<number> {
    const agora = new Date();
    const limiteAntigos = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { affected } = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshTokenEntity)
      .where(
        new Brackets((qb) =>
          qb
            .where('"expiresAt" < :agora', { agora })
            .orWhere('"revokedAt" IS NOT NULL AND "revokedAt" < :limiteAntigos', { limiteAntigos }),
        ),
      )
      .execute();
    return affected ?? 0;
  }
}