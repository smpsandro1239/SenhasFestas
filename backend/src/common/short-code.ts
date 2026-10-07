const LIMITE = 32;

export const FORMATO_SHORT_CODE = /^[a-z0-9-]{3,32}$/;

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

export function gerarShortCode(nome: string, id: string): string {
  const base = normalizarShortCode(nome);
  return base.length >= 3 ? base : `evento-${id.slice(0, 8)}`;
}

export function escolherShortCode(base: string, ocupado: (cand: string) => boolean): string {
  if (!ocupado(base)) return base;
  for (let n = 2; n < 100; n++) {
    const sufixo = `-${n}`;
    const tronco = base.slice(0, LIMITE - sufixo.length).replace(/-+$/, '');
    const candidato = tronco + sufixo;
    if (!ocupado(candidato)) return candidato;
  }
  throw new Error('Sem shortCode livre após 99 tentativas');
}
