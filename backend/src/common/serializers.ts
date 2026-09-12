import { UserEntity } from '../entities';

export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function toPublicUser<T extends Partial<UserEntity>>(
  user: T | null | undefined,
): Partial<UserEntity> | null {
  if (!user) {
    return null;
  }
  const { password: _password, ...safe } = user as Partial<UserEntity> & { password?: string };
  return safe;
}

const CAMPOS_SENSIVEIS = new Set(['password', 'token', 'refreshToken', 'tokenHash']);

export function snapshot(value: unknown, profundidade = 4): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (profundidade <= 0) {
    return '[…]';
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => snapshot(item, profundidade - 1));
  }
  if (typeof value === 'object') {
    const entrada: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(value as Record<string, unknown>)) {
      if (CAMPOS_SENSIVEIS.has(chave)) {
        continue;
      }
      if (typeof valor === 'function') {
        continue;
      }
      entrada[chave] = snapshot(valor, profundidade - 1);
    }
    return entrada;
  }
  return value;
}
