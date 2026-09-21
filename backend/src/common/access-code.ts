import { ConflictException } from '@nestjs/common';

export function gerarCodigoAcesso(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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