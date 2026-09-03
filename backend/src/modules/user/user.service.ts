import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities';
import { UpdateUserDto } from './dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findAll(): Promise<Partial<UserEntity>[]> {
    return this.userRepository.find({
      select: { id: true, email: true, name: true, role: true, phone: true, isActive: true, createdAt: true, updatedAt: true },
    });
  }

  async findOne(id: string): Promise<Partial<UserEntity>> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: { id: true, email: true, name: true, role: true, phone: true, isActive: true, createdAt: true, updatedAt: true },
    });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }
    return user;
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