import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { RegisterDto } from './auth.controller';

describe('RegisterDto — política de password', () => {
  it('rejeita passwords com menos de 12 caracteres', async () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'user@example.com',
      password: 'curta123',
      name: 'Utilizador',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('aceita uma frase-passe com pelo menos 12 caracteres', async () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'user@example.com',
      password: 'frase-passe-segura-2026',
      name: 'Utilizador',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'password')).toBe(false);
  });
});
