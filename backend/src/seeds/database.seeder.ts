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

  private passwordDeTeste(role: string): string {
    const plain = process.env.SEED_PASSWORD;
    if (!plain) {
      throw new Error(
        `Seeder requer SEED_PASSWORD no env (fase desenvolvimento). ` +
          `Define a palavra-passe dos utilizadores de teste (ex.: no .env raiz) antes de arrancar.`,
      );
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Seeder não pode correr em produção');
    }
    return `${plain}-${role}`;
  }

  async seedUsers(): Promise<void> {
    const users = [
      {
        email: 'admin@senhasfestas.com',
        role: 'superadmin',
        name: 'Administrador',
        phone: '910000000',
      },
      {
        email: 'organizer@senhasfestas.com',
        role: 'organizer',
        name: 'Organizador',
        phone: '910000001',
      },
      {
        email: 'cashier@senhasfestas.com',
        role: 'cashier',
        name: 'Operador Caixa',
        phone: '910000002',
      },
      {
        email: 'kitchen@senhasfestas.com',
        role: 'kitchen',
        name: 'Equipa Cozinha',
        phone: '910000003',
      },
      {
        email: 'bar@senhasfestas.com',
        role: 'bar',
        name: 'Operador Bar',
        phone: '910000004',
      },
      {
        email: 'treasurer@senhasfestas.com',
        role: 'treasurer',
        name: 'Tesoureiro',
        phone: '910000005',
      },
      {
        email: 'client@senhasfestas.com',
        role: 'client',
        name: 'Cliente de Teste',
        phone: '910000006',
      },
    ];

    let created = 0;
    for (const userData of users) {
      const existing = await this.userRepository.findOne({ where: { email: userData.email } });
      if (existing) {
        continue;
      }
      const user = this.userRepository.create({
        ...userData,
        password: await bcrypt.hash(this.passwordDeTeste(userData.role), 10),
      });
      await this.userRepository.save(user);
      created += 1;
    }

    if (created > 0) {
      console.log(`[Seeder] ${created} utilizadores de teste criados com sucesso`);
    }
  }
}