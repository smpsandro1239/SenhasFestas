import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../../entities';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: Partial<UserEntity> }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);
    const { password: _, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
    };
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
      throw new UnauthorizedException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      role,
      phone,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);
    const { password: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword;
  }

  async validateUser(payload: JwtPayload): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid user');
    }
    return user;
  }
}