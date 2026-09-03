import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class DatabaseSeederService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async seed(): Promise<void> {
    await this.seedUsers();
  }

  async seedUsers(): Promise<void> {
    const adminExists = await this.userRepository.findOne({ where: { email: 'admin@senhasfestas.com' } });
    if (adminExists) {
      return;
    }

    const users = [
      {
        email: 'admin@senhasfestas.com',
        password: await bcrypt.hash('admin123', 10),
        name: 'Admin',
        role: 'superadmin',
        phone: '910000000',
      },
      {
        email: 'organizer@senhasfestas.com',
        password: await bcrypt.hash('organizer123', 10),
        name: 'Organizador',
        role: 'organizer',
        phone: '910000001',
      },
      {
        email: 'cashier@senhasfestas.com',
        password: await bcrypt.hash('cashier123', 10),
        name: 'Operador Caixa',
        role: 'cashier',
        phone: '910000002',
      },
      {
        email: 'kitchen@senhasfestas.com',
        password: await bcrypt.hash('kitchen123', 10),
        name: 'Equipa Cozinha',
        role: 'kitchen',
        phone: '910000003',
      },
      {
        email: 'bar@senhasfestas.com',
        password: await bcrypt.hash('bar123', 10),
        name: 'Operador Bar',
        role: 'bar',
        phone: '910000004',
      },
      {
        email: 'treasurer@senhasfestas.com',
        password: await bcrypt.hash('treasurer123', 10),
        name: 'Tesoureiro',
        role: 'treasurer',
        phone: '910000005',
      },
    ];

    for (const userData of users) {
      const user = this.userRepository.create(userData);
      await this.userRepository.save(user);
    }

    console.log(`[Seeder] ${users.length} utilizadores criados com sucesso`);
  }
}