import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserEntity, RefreshTokenEntity } from '../../entities';

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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
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
    const { password: _, ...rest } = user;
    return rest;
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
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Utilizador inativo');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
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
    if (stored.revokedAt || stored.isUsed || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expirado ou já utilizado');
    }

    const user = await this.assertUserActive(stored.userId);

    stored.revokedAt = new Date();
    stored.isUsed = true;
    await this.refreshTokenRepository.save(stored);

    const raw = await this.emitRefreshToken(user.id);
    const newHash = this.hashToken(raw);
    const latest = await this.refreshTokenRepository.findOne({
      where: { userId: user.id, tokenHash: newHash },
      order: { createdAt: 'DESC' },
    });
    if (latest) {
      latest.replacedByTokenId = stored.id;
      await this.refreshTokenRepository.save(latest);
    }

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
  ): Promise<Partial<UserEntity>> {
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
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);
    return this.sanitizeUser(savedUser);
  }

  async validateUser(payload: JwtPayload): Promise<UserEntity> {
    return this.assertUserActive(payload.sub);
  }

  async cleanupExpiredTokens(): Promise<number> {
    const { affected } = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return affected ?? 0;
  }
}