import * as crypto from 'crypto';
import { ConflictException } from '@nestjs/common';

const MINIMO = 100000;
const MAXIMO = 1000000;

/**
 * Código de 6 dígitos, só numéricos. `crypto.randomInt` em vez de
 * `Math.random`: este não é criptograficamente seguro, e um PRNG previsível
 * permite a quem observe os códigos gerados inferir os seguintes.
 */
export function gerarCodigoAcesso(): string {
  return String(crypto.randomInt(MINIMO, MAXIMO));
}

export async function codigoAcessoUnico(
  checarExiste: (codigo: string) => Promise<boolean>,
): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const codigo = gerarCodigoAcesso();
    if (!(await checarExiste(codigo))) {
      return codigo;
    }
  }
  throw new ConflictException('Não foi possível gerar um código de acesso único após 100 tentativas');
}