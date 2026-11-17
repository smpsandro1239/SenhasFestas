import { describe, expect, it, vi } from 'vitest';
import { BootstrapAdminService } from './bootstrap-admin.service';

function criarService(password: string) {
  const userRepository = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((value) => value),
    save: vi.fn().mockImplementation(async (value) => value),
  };
  const configService = {
    get: vi.fn((key: string) => ({
      BOOTSTRAP_ADMIN_EMAIL: 'admin@example.com',
      BOOTSTRAP_ADMIN_PASSWORD: password,
    })[key]),
  };
  return {
    service: new BootstrapAdminService(userRepository as any, configService as any),
    userRepository,
  };
}

describe('BootstrapAdminService — password policy', () => {
  it('recusa passwords de bootstrap inferiores a 12 caracteres', async () => {
    const { service, userRepository } = criarService('admin123');
    await expect(service.onApplicationBootstrap()).rejects.toThrow(/pelo menos 12 caracteres/);
    expect(userRepository.findOne).not.toHaveBeenCalled();
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
