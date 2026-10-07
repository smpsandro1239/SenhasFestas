const LIMITE = 32;

export function normalizarShortCode(nome: string): string {
  return nome
    .replace(/ª/g, 'a')
    .replace(/º/g, 'o')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, LIMITE)
    .replace(/-+$/, '');
}

export function podeTrocarEvento(saldos: { balance?: number }[]): boolean {
  return saldos.every((saldo) => Number(saldo.balance ?? 0) === 0);
}
