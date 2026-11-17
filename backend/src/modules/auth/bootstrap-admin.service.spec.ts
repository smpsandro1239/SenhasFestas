import { describe, expect, it, vi } from 'vitest';
import { BootstrapAdminService } from './bootstrap-admin.service';

function criarService(password: string) {
  const userRepository = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((value: any) => value),
    save: vi.fn().mockImplementation(async (value) => value),
  };
  const valores: Record<string, string> = {
    BOOTSTRAP_ADMIN_EMAIL: 'admin@example.com',
    BOOTSTRAP_ADMIN_PASSWORD: password,
  };
  const configService = {
    get: vi.fn((key: string) => valores[key]),
  };
  return {
    service: new BootstrapAdminService(userRepository as any, configService as any),
    userRepository,
  };
}

describe('BootstrapAdminService — password policy', () => {
  it('recusa passwords de bootstrap inferiores a 12 caracteres', async () => {
    const { service, userRepository } = criarService('admin123');
    await expect(service.onApplicationBootstrap()).rejects.toThrow(/12 e 72 bytes UTF-8/);
    expect(userRepository.findOne).toHaveBeenCalledOnce();
  });

  it('recusa passwords multibyte acima dos 72 bytes do bcrypt', async () => {
    const { service, userRepository } = criarService('🔐'.repeat(19));
    await expect(service.onApplicationBootstrap()).rejects.toThrow(/72 bytes UTF-8/);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('não bloqueia o arranque se o administrador bootstrap já existir', async () => {
    const { service, userRepository } = criarService('admin123');
    userRepository.findOne.mockResolvedValue({ id: 'existing-admin' });

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('cria o administrador com password forte e armazenada por hash', async () => {
    const { service, userRepository } = criarService('SenhasFestas-CI-2026!');
    await service.onApplicationBootstrap();

    expect(userRepository.save).toHaveBeenCalledOnce();
    const saved = userRepository.save.mock.calls[0][0];
    expect(saved.role).toBe('superadmin');
    expect(saved.password).not.toBe('SenhasFestas-CI-2026!');
    expect(saved.password).toMatch(/^\$2[aby]\$/);
  });
});
