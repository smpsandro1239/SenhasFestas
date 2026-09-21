import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../../entities';
import { codigoAcessoUnico } from '../../common/access-code';

@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.configService.get<string>('BOOTSTRAP_ADMIN_EMAIL');
    const password = this.configService.get<string>('BOOTSTRAP_ADMIN_PASSWORD');
    if (!email || !password) {
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      const fracas = ['admin123', 'senhasfestas', 'password', '12345678'];
      if (password.length < 8 || fracas.includes(password.toLowerCase())) {
        throw new Error('BOOTSTRAP_ADMIN_PASSWORD: valor fraco não permitido em produção');
      }
    }
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userRepository.save(
      this.userRepository.create({
        email,
        password: hashedPassword,
        name: 'Administrador',
        role: 'superadmin',
        accessCode: await codigoAcessoUnico(async (c) =>
          Boolean(await this.userRepository.findOne({ where: { accessCode: c } })),
        ),
        isActive: true,
      }),
    );
    this.logger.log(`Administrador de bootstrap criado para ${email}`);
  }
}