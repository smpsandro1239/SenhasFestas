#!/usr/bin/env node
/* Reset das 7 contas de teste em produção — PREPARADO, NÃO EXECUTAR sem decisão.
 *
 * Contexto: as contas usam passwords que estiveram no repo/histórico git; o
 * admin tem accessCode 370725 exposto. O único anulador real é alterar a base
 * diretamente (não depende das credenciais antigas). A password do Neon é
 * passo manual teu no dashboard.
 *
 * DECISÃO DE CONCEÇÃO (obrigatória — escolhe UMA intenção):
 *   1) Re-chavear (--apply): passwords+accessCodes novos; refresh tokens
 *      revogados (sessões roubadas morrem); novas credenciais só no ficheiro
 *      RESET_OUTPUT_FILE (nunca stdout). Fail-closed sem o ficheiro.
 *   2) Invalidar (--invalidate): password descartada + isActive=false +
 *      revogação de tokens — contas inacessíveis, mas sem apagar linhas nem
 *      histórico (o projeto usa soft-delete; histórico financeiro é imutável).
 *   NÃO existe --delete: apagar linhas quebra FKs ou cascateia histórico.
 *   Ambos os modos são transacionais (BEGIN/COMMIT/ROLLBACK) e revogam tokens
 *   ANTES de fechar: um refresh roubado dura 30 dias; o reset tem de o matar.
 *
 * Uso:
 *   DATABASE_URL='postgres://...' node scripts/reset-contas-prod.mjs            # dry-run
 *   DATABASE_URL='...' RESET_OUTPUT_FILE='C:\...\novas.creds' \
 *     node scripts/reset-contas-prod.mjs --apply                                # re-chaveia e grava
 *   DATABASE_URL='...' node scripts/reset-contas-prod.mjs --invalidate          # invalida
 *
 * Honestidade: o load (módulos, validações, ligação) está provado; as escritas
 * (UPDATE/UPDATE tokens/ficheiro) só contra a base real — corre o dry-run
 * primeiro, revê, e só depois o modo escolhido.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync, unlinkSync } from 'node:fs';

// pg e bcryptjs vivem em backend/node_modules — resolver a partir de lá, não da raiz.
const require = createRequire(new URL('../backend/package.json', import.meta.url));

const EMAILS_PROD = [
  'admin@senhasfestas.com',
  'organizer@senhasfestas.com',
  'cashier@senhasfestas.com',
  'bar@senhasfestas.com',
  'kitchen@senhasfestas.com',
  'treasurer@senhasfestas.com',
  'client@senhasfestas.com',
];

const RE_CHAVEAR = process.argv.includes('--apply');
const INVALIDAR = process.argv.includes('--invalidate');
const DATABASE_URL = process.env.DATABASE_URL;
const RESULTADOS = process.env.RESET_OUTPUT_FILE;

if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL no env (produção). Abortar — nunca usar a base de dev para este reset.');
  process.exit(1);
}
if (!/postgres(ql)?:\/\//.test(DATABASE_URL)) {
  console.error('DATABASE_URL não parece ser Postgres. Abortar.');
  process.exit(1);
}
if (RE_CHAVEAR && INVALIDAR) {
  console.error('--apply e --invalidate são mutuamente exclusivos — decide a intenção do reset.');
  process.exit(1);
}
if (RE_CHAVEAR && !RESULTADOS) {
  console.error(
    '--apply sem RESET_OUTPUT_FILE recusa-se a correr: sem ficheiro de output, as ' +
      'novas passwords/accessCodes perdem-se e as contas ficam trancadas sem recuperação.',
  );
  process.exit(1);
}

async function accessCodeUnico(cliente) {
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const codigo = String(randomInt(100000, 1000000));
    const existe = await cliente.query(`SELECT 1 FROM "users" WHERE "accessCode" = $1 LIMIT 1`, [codigo]);
    if (existe.rowCount === 0) return codigo;
  }
  throw new Error('Não consegui um accessCode único em 20 tentativas — transação revertida, nada alterado.');
}

const { Client } = require('pg');
const cliente = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  try {
    await cliente.connect();
  } catch (erro) {
    console.error('Não consegui ligar à base (revê DATABASE_URL, rede e SSL):', erro.message);
    process.exit(1);
  }
  const proximo = await cliente.query(
    `SELECT id, email, role, "accessCode", "isActive" FROM "users" WHERE email = ANY($1) ORDER BY email`,
    [EMAILS_PROD],
  );

  console.log(`Contas de teste em produção: ${proximo.rowCount}`);
  for (const linha of proximo.rows) {
    console.log(`  - ${linha.email} (${linha.role}, accessCode=${linha.accessCode}, isActive=${linha['isActive']})`);
  }

  const efemeros = await cliente.query(`SELECT count(*)::int AS n FROM "users" WHERE email LIKE 'e2e-%@'`);
  console.log(`Utilizadores efémeros de E2E na DB (apenas e2e-*@): ${efemeros.rows[0]?.n ?? 0}`);

  if (!RE_CHAVEAR && !INVALIDAR) {
    console.log('\nDry-run — nada alterado. Revisão: (a) --apply roda passwords+accessCodes, revoga tokens' +
      ' e grava em RESET_OUTPUT_FILE; (b) --invalidate descarta passwords, baixa isActive e revoga tokens.');
    process.exit(0);
  }

  if (RE_CHAVEAR) {
    try {
      writeFileSync(RESULTADOS, '', { flag: 'wx' });
    } catch {
      console.error(`Já existe ${RESULTADOS} — remove/renomeia antes de rodar (nada foi alterado na base).`);
      process.exit(1);
    }
    console.log(`Ficheiro de output reivindicado (vazio): ${RESULTADOS}`);
  }

  await cliente.query('BEGIN');
  try {
    const ids = proximo.rows.map((linha) => linha.id);
    const novas = [];

    for (const linha of proximo.rows) {
      const novaPassword = randomBytes(24).toString('base64');
      const hash = await require('bcryptjs').hash(novaPassword, 10);

      if (RE_CHAVEAR) {
        const novoCodigo = await accessCodeUnico(cliente);
        await cliente.query(`UPDATE "users" SET password = $1, "accessCode" = $2 WHERE email = $3`, [
          hash,
          novoCodigo,
          linha.email,
        ]);
        novas.push({ email: linha.email, role: linha.role, password: novaPassword, accessCode: novoCodigo });
        console.log(`  ~ ${linha.email}: re-chaveada (password + accessCode; valores só no ficheiro)`);
      } else {
        await cliente.query(`UPDATE "users" SET password = $1, "isActive" = false WHERE email = $2`, [
          hash,
          linha.email,
        ]);
        console.log(`  ~ ${linha.email}: invalidada (password descartada, isActive=false)`);
      }
    }

    const revogadas = await cliente.query(
      `UPDATE "refresh_tokens" SET "revokedAt" = now(), "isUsed" = true ` +
        `WHERE "userId" = ANY($1::uuid[]) AND "revokedAt" IS NULL`,
      [ids],
    );
    console.log(`Refresh tokens revogados (sessões ativas mortas): ${revogadas.rowCount}`);

    if (RE_CHAVEAR) {
      const corpo = novas.map((n) => `${n.email}\t${n.role}\t${n.password}\t${n.accessCode}`).join('\n');
      writeFileSync(RESULTADOS, `${corpo}\n`);
    }

    await cliente.query('COMMIT');
    console.log('\nCOMMIT — tudo ou nada aplicado.');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    if (RE_CHAVEAR) {
      try {
        unlinkSync(RESULTADOS);
      } catch {
        /* nada a remover */
      }
    }
    console.error('ERRO — transação revertida, base intacta:', erro.message);
    process.exit(1);
  }

  if (RE_CHAVEAR) {
    console.log(`Novas credenciais em: ${RESULTADOS}`);
    console.log('Move-as para o teu gestor de passwords e APAGA o ficheiro. Depois: rotação da password do Neon ' +
      '(dashboard) e atualiza as E2E_* do teu env — a suite volta a correr.');
  } else {
    console.log('Contas invalidadas. Sem credenciais novas — para voltar a usar a suite, recria contas propositadamente.');
  }
} finally {
  await cliente.end().catch(() => {});
}