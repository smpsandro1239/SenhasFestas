#!/usr/bin/env node
/* Reset das 7 contas de teste em produção — PREPARADO, NÃO EXECUTAR sem decisão.
 *
 * Contexto: as contas usam passwords que estiveram no repo/histórico git. O único
 * anulador real é alterá-las na base diretamente (não depende das credenciais
 * antigas). A password do Neon é passo manual teu no dashboard.
 *
 * DECISÃO DE CONCEÇÃO (obrigatória — o reset tem de escolher UMA intenção):
 *   1) Re-chavear (--apply): as contas continuam usáveis com passwords NOVAS e
 *      accessCodes novos. As novas credenciais NUNCA vão para stdout/transcript:
 *      só para o ficheiro indicado em RESET_OUTPUT_FILE (que TU controlas).
 *      Sem RESET_OUTPUT_FILE o --apply recusa-se a correr (fail-closed).
 *   2) Invalidar e esquecer (--delete): apaga as 7 contas da base. Nada a
 *      recuperar; a suite Playwright deixa de correr contra produção até
 *      recriares contas.
 *   O que NÃO existe: rotacionar e descartar (contas trancadas sem recuperação).
 *
 * Uso:
 *   DATABASE_URL='postgres://...' node scripts/reset-contas-prod.mjs            # dry-run
 *   DATABASE_URL='...' RESET_OUTPUT_FILE='C:\...\novas.creds' \
 *     node scripts/reset-contas-prod.mjs --apply                                # re-chaveia e grava
 *   DATABASE_URL='...' node scripts/reset-contas-prod.mjs --delete              # apaga
 *
 * Honestidade: o load (módulos, checks, ligação) está provado; o UPDATE/DELETE
 * só pode ser provado contra a base real — corre o dry-run primeiro, revê, e só
 * depois o modo escolhido.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

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

const APLICAR = process.argv.includes('--apply');
const APAGAR = process.argv.includes('--delete');
const DATABASE_URL = process.env.DATABASE_URL;
const RESULTADOS = process.env.RESET_OUTPUT_FILE;

if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL no env (produção). Abortar — nunca usar a base de dev para este reset.');
  process.exit(1);
}
if (APLICAR && APAGAR) {
  console.error('--apply e --delete são mutuamente exclusivos — decide a intenção do reset.');
  process.exit(1);
}
if (!APLICAR && !APAGAR && !/postgres(ql)?:\/\//.test(DATABASE_URL)) {
  console.error('DATABASE_URL não parece ser Postgres. Abortar.');
  process.exit(1);
}
if (APLICAR && !RESULTADOS) {
  console.error(
    '--apply sem RESET_OUTPUT_FILE recusa-se a correr: sem ficheiro de output, as ' +
      'novas passwords/accessCodes perdem-se e as 7 contas ficam trancadas sem recuperação.',
  );
  process.exit(1);
}

async function accessCodeUnico(cliente) {
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const codigo = String(randomInt(100000, 1000000));
    const existe = await cliente.query(`SELECT 1 FROM "users" WHERE "accessCode" = $1 LIMIT 1`, [codigo]);
    if (existe.rowCount === 0) return codigo;
  }
  throw new Error('Não consegui um accessCode único em 20 tentativas — abortar sem escrever nada.');
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
    `SELECT email, role, "accessCode", "isActive" FROM "users" WHERE email = ANY($1) ORDER BY email`,
    [EMAILS_PROD],
  );

  console.log(`Contas de teste em produção: ${proximo.rowCount}`);
  for (const linha of proximo.rows) {
    console.log(`  - ${linha.email} (${linha.role}, accessCode=${linha.accessCode}, isActive=${linha['isActive']})`);
  }

  const efemeros = await cliente.query(`SELECT count(*)::int AS n FROM "users" WHERE email LIKE 'e2e-%@'`);
  console.log(`Utilizadores efémeros de E2E na DB (apenas e2e-*@): ${efemeros.rows[0]?.n ?? 0}`);

  if (!APLICAR && !APAGAR) {
    console.log('\nDry-run — nada alterado. Revisão: (a) --apply roda passwords+accessCodes e grava' +
      ' em RESET_OUTPUT_FILE; (b) --delete apaga as contas. Ambos mantêm a rotação do Neon como passo teu.');
    process.exit(0);
  }

  if (APAGAR) {
    const apagadas = await cliente.query(`DELETE FROM "users" WHERE email = ANY($1)`, [EMAILS_PROD]);
    console.log(`\nApagadas ${apagadas.rowCount} contas. Sem recuperação — a suite Playwright deixa de correr contra prod.`);
    process.exit(0);
  }

  const novas = [];
  for (const linha of proximo.rows) {
    const novaPassword = randomBytes(24).toString('base64');
    const hash = await require('bcryptjs').hash(novaPassword, 10);
    const novoCodigo = await accessCodeUnico(cliente);
    await cliente.query(`UPDATE "users" SET password = $1, "accessCode" = $2 WHERE email = $3`, [
      hash,
      novoCodigo,
      linha.email,
    ]);
    novas.push({ email: linha.email, role: linha.role, password: novaPassword, accessCode: novoCodigo });
    console.log(`  ~ ${linha.email}: re-chaveada (password + accessCode; valores só no ficheiro de output)`);
  }

  const corpo = novas
    .map((n) => `${n.email}\t${n.role}\t${n.password}\t${n.accessCode}`)
    .join('\n');
  writeFileSync(RESULTADOS, `${corpo}\n`, { mode: 0o600, flag: 'wx' });
  console.log(`\nNovas credenciais gravadas em: ${RESULTADOS}`);
  console.log('Move-as para o teu gestor de passwords e APAGA o ficheiro. Roda a rotação da password ' +
    'do Neon no dashboard e atualiza as E2E_* do teu env com as novas (a suite volta a correr).');
} finally {
  await cliente.end().catch(() => {});
}