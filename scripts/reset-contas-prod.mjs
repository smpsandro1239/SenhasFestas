#!/usr/bin/env node
/* Reset das contas de teste em produção — PREPARADO, NÃO EXECUTAR sem decisão.
 *
 * Contexto: as 7 contas de teste (emails senhasfestas.com) usam passwords que
 * estiveram em ficheiros do repo e no histórico git. O único anulador real é
 * trocar as passwords na base de dados diretamente (não depende das credenciais
 * antigas) — e rodar a password do Neon no dashboard (passo manual, teu lado).
 *
 * Uso (NÃO correr agora; requer revisão + DATABASE_URL de produção):
 *   DATABASE_URL='postgres://...' node scripts/reset-contas-prod.mjs        # dry-run (lista)
 *   DATABASE_URL='postgres://...' node scripts/reset-contas-prod.mjs --apply # troca mesmo
 *
 * Em modo --apply gera passwords aleatórias (não as imprime), grava o hash
 * bcrypt na DB e reporta apenas o email + estado. Só altera a coluna password.
 */
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

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
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL no env (produção). Abortar — nunca usar a base de dev para este reset.');
  process.exit(1);
}
if (APLICAR && !/postgres(ql)?:\/\//.test(DATABASE_URL)) {
  console.error('DATABASE_URL não parece ser Postgres. Abortar.');
  process.exit(1);
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
    `SELECT email, role, "isActive" FROM "users" WHERE email = ANY($1) ORDER BY email`,
    [EMAILS_PROD],
  );

  console.log(`Contas de teste em produção: ${proximo.rowCount}`);
  for (const linha of proximo.rows) {
    console.log(`  - ${linha.email} (${linha.role}, isActive=${linha['isActive']})`);
  }

  const lixo = await cliente.query(
    `SELECT count(*)::int AS n FROM "users" WHERE email LIKE 'e2e-%' OR email LIKE 'reg-%' OR email LIKE 'm-%@' OR email LIKE 'p-%@'`,
  );
  console.log(`Utilizadores efémeros de E2E/registo na DB: ${lixo.rows[0]?.n ?? 0}`);

  if (!APLICAR) {
    console.log('\nDry-run — nada alterado. Com --apply troca as passwords para valores aleatórios.');
    process.exit(0);
  }

  for (const linha of proximo.rows) {
    const nova = randomBytes(24).toString('base64');
    const hash = await require('bcryptjs').hash(nova, 10);
    await cliente.query(`UPDATE "users" SET password = $1 WHERE email = $2`, [hash, linha.email]);
    console.log(`  ~ ${linha.email}: password ROTACIONADA (nova não impressa)`);
  }
  console.log('\nConcluído. Roda agora a rotação da password do Neon no dashboard e atualiza as E2E_* do teu env com as novas passwords (não as imprimo aqui).');
} finally {
  await cliente.end().catch(() => {});
}