import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { LoginDto, RegisterDto } from './auth.controller';
import { CreateUserDto } from '../user/dto';

describe('DTOs de Autenticação — Validação de Password (Proteção DoS Bcrypt)', () => {
  describe('LoginDto', () => {
    it('aceita password válida com tamanho <= 72 caracteres', async () => {
      const dto = new LoginDto();
      dto.email = 'utilizador@exemplo.pt';
      dto.password = 'a'.repeat(72);

      const erros = await validate(dto);
      expect(erros).toHaveLength(0);
    });

    it('rejeita password com mais de 72 caracteres', async () => {
      const dto = new LoginDto();
      dto.email = 'utilizador@exemplo.pt';
      dto.password = 'a'.repeat(73);

      const erros = await validate(dto);
      expect(erros.length).toBeGreaterThan(0);
      const erroPassword = erros.find((e) => e.property === 'password');
      expect(erroPassword?.constraints).toHaveProperty('maxLength');
    });

    it('rejeita password com menos de 6 caracteres', async () => {
      const dto = new LoginDto();
      dto.email = 'utilizador@exemplo.pt';
      dto.password = '12345';

      const erros = await validate(dto);
      expect(erros.length).toBeGreaterThan(0);
      const erroPassword = erros.find((e) => e.property === 'password');
      expect(erroPassword?.constraints).toHaveProperty('minLength');
    });
  });

  describe('RegisterDto', () => {
    it('aceita password válida com tamanho <= 72 caracteres', async () => {
      const dto = new RegisterDto();
      dto.email = 'novo@exemplo.pt';
      dto.password = 'segredo123';
      dto.name = 'Novo Utilizador';

      const erros = await validate(dto);
      expect(erros).toHaveLength(0);
    });

    it('rejeita password com mais de 72 caracteres no registo', async () => {
      const dto = new RegisterDto();
      dto.email = 'novo@exemplo.pt';
      dto.password = 'b'.repeat(73);
      dto.name = 'Novo Utilizador';

      const erros = await validate(dto);
      expect(erros.length).toBeGreaterThan(0);
      const erroPassword = erros.find((e) => e.property === 'password');
      expect(erroPassword?.constraints).toHaveProperty('maxLength');
    });
  });

  describe('CreateUserDto', () => {
    it('aceita password válida com tamanho <= 72 caracteres', async () => {
      const dto = new CreateUserDto();
      dto.email = 'admin@exemplo.pt';
      dto.password = 'c'.repeat(72);
      dto.name = 'Administrador';
      dto.role = 'organizer';

      const erros = await validate(dto);
      expect(erros).toHaveLength(0);
    });

    it('rejeita password com mais de 72 caracteres ao criar utilizador', async () => {
      const dto = new CreateUserDto();
      dto.email = 'admin@exemplo.pt';
      dto.password = 'c'.repeat(73);
      dto.name = 'Administrador';
      dto.role = 'organizer';

      const erros = await validate(dto);
      expect(erros.length).toBeGreaterThan(0);
      const erroPassword = erros.find((e) => e.property === 'password');
      expect(erroPassword?.constraints).toHaveProperty('maxLength');
    });
  });
});
