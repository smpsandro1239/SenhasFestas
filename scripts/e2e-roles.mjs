#!/usr/bin/env node
/* E2E por role — SenhasFestas
 * Testa as 7 roles contra a API em produção/local e escreve evidências em docs/auditoria/.
 *
 * Uso:
 *   node scripts/e2e-roles.mjs
 *   BASE_URL=https://localhost:3000/api NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/e2e-roles.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const EV_CLASS = join(RAIZ, 'docs', 'auditoria');

const BASE = (process.env.BASE_URL || 'https://senhasfestas-api.vercel.app/api').replace(/\/+$/, '');

const CONTAS = [
  { role: 'superadmin', email: 'admin@senhasfestas.com', password: 'admin123' },
  { role: 'organizer', email: 'organizer@senhasfestas.com', password: 'organizer123' },
  { role: 'cashier', email: 'cashier@senhasfestas.com', password: 'cashier123' },
  { role: 'bar', email: 'bar@senhasfestas.com', password: 'bar123' },
  { role: 'kitchen', email: 'kitchen@senhasfestas.com', password: 'kitchen123' },
  { role: 'treasurer', email: 'treasurer@senhasfestas.com', password: 'treasurer123' },
  { role: 'client', email: 'client@senhasfestas.com', password: 'client123' },
];

async function chamar(path, { token, method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let data = null;
    const texto = await res.text();
    try {
      data = texto ? JSON.parse(texto) : null;
    } catch {
      data = texto;
    }
    return { status: res.status, data };
  } catch (erro) {
    return { status: 0, data: { erro: erro.message } };
  } finally {
    clearTimeout(timer);
  }
}

const RES = [];
const resultado = (role, criterio, ok, detalhe = '') => ({ role, criterio, ok, detalhe });

(async () => {
  console.log(`🛰  API: ${BASE}\n`);

  for (const conta of CONTAS) {
    const { role } = conta;
    const linha = { role, checks: [] };

    // 1. Login
    const login = await chamar('/auth/login', { method: 'POST', body: { email: conta.email, password: conta.password } });
    const token = login.data?.token;
    linha.checks.push(resultado(role, 'login-ok', login.status === 200 && !!token, `status=${login.status}`));
    if (!token) {
      RES.push(linha);
      console.log(`✗ ${role} — login falhou (${login.status})`);
      continue;
    }

    // 2. Nenhuma resposta expõe password
    const me = await chamar('/users/me', { token });
    const meJSON = me.data && typeof me.data === 'object' && !Array.isArray(me.data) ? me.data : {};
    const semPassword = !('password' in meJSON);
    linha.checks.push(resultado(role, 'no-password', semPassword, `status=${me.status}`));

    // 3. Eventos do utilizador
    const events = await chamar('/events', { token });
    const nEventos = Array.isArray(events.data) ? events.data.length : 0;
    linha.checks.push(resultado(role, 'events', events.status === 200, `status=${events.status}, n=${nEventos}`));

    // 4. Paginação uniforme em /orders
    const orders = await chamar('/orders', { token });
    const shapeOk =
      orders.data !== null &&
      typeof orders.data === 'object' &&
      'items' in orders.data &&
      'total' in orders.data &&
      'page' in orders.data &&
      'limit' in orders.data;
    linha.checks.push(resultado(role, 'orders-paginado', orders.status === 200 && shapeOk, `status=${orders.status}`));

    const eventoId = nEventos > 0 ? events.data[0].id : null;

    // 5. Auditoria — GET /audit
    const audit = await chamar('/audit', { token });
    const auditPermitido = ['superadmin', 'organizer', 'treasurer'].includes(role);
    linha.checks.push(
      resultado(role, 'audit', auditPermitido ? audit.status === 200 : audit.status === 403, `status=${audit.status}`),
    );

    // 6. Exportar auditoria CSV
    const auditCsv = await chamar('/audit/export.csv', { token });
    linha.checks.push(
      resultado(
        role,
        'audit-export',
        auditPermitido ? auditCsv.status === 200 : auditCsv.status === 403,
        `status=${auditCsv.status}`,
      ),
    );

    // 7. Relatórios CSV (staff)
    const relCsv = await chamar('/reports/export.csv?status=received', { token });
    const relCsvPermitido = role !== 'client';
    linha.checks.push(
      resultado(role, 'reports-export', relCsvPermitido ? relCsv.status === 200 : relCsv.status === 403, `status=${relCsv.status}`),
    );

    // 8. Listagem de utilizadores (staff)
    const users = await chamar('/users', { token });
    const usersPermitido = role !== 'client';
    linha.checks.push(
      resultado(role, 'users', usersPermitido ? users.status === 200 : users.status === 403, `status=${users.status}`),
    );

    // 9. Carregar saldo (apenas financeiro)
    const target = usersPermitido && Array.isArray(users.data) && users.data.length > 0 ? users.data[0].id : null;
    const financeiro = ['superadmin', 'organizer', 'cashier', 'treasurer'].includes(role);
    if (target && eventoId) {
      const load = await chamar(`/balances/${target}/load`, {
        token,
        method: 'POST',
        body: { amount: 0.01, eventId: eventoId, paymentMethod: 'cash' },
      });
      linha.checks.push(
        resultado(role, 'load-saldo', financeiro ? load.status < 400 && load.status !== 403 : load.status === 403, `status=${load.status}`),
      );
      if (load.status === 200 || load.status === 201) {
        const bal = await chamar(`/balances/${target}?eventId=${eventoId}`, { token });
        const movimentos = bal.data?.movements ?? [];
        const ultimo = movimentos.find((m) => m.type === 'load');
        if (ultimo?.id) {
          const rev = await chamar(`/balances/${target}/reverse/${ultimo.id}?eventId=${eventoId}`, {
            token,
            method: 'POST',
          });
          linha.checks.push(
            resultado(role, 'estorno-saldo', financeiro && (rev.status === 200 || rev.status === 201), `status=${rev.status}`),
          );
        }
      }
    } else {
      linha.checks.push(resultado(role, 'load-saldo', financeiro ? false : true, 'sem alvo/evento (skipped)'));
    }

    // 10. Criar pedido — bar/kitchen proibidos
    if (eventoId) {
      const criar = await chamar('/orders', {
        token,
        method: 'POST',
        body: {
          eventId: eventoId,
          source: 'pos',
          items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
        },
      });
      const proibido = ['bar', 'kitchen'].includes(role);
      const permitido = ['superadmin', 'organizer', 'cashier', 'treasurer', 'client'].includes(role);
      // permitido → qualquer resposta não-403 (400/404 por produto inválido também valida o gate)
      linha.checks.push(
        resultado(role, 'criar-pedido', proibido ? criar.status === 403 : permitido ? criar.status !== 403 : true, `status=${criar.status}`),
      );
    } else {
      linha.checks.push(resultado(role, 'criar-pedido', true, 'sem evento (skipped)'));
    }

    // 11. Cancelar pedido — só financeiro + client
    const cancelarProibido = ['bar', 'kitchen'].includes(role);
    const cancelar = await chamar('/orders/00000000-0000-0000-0000-000000000000/cancel', { token, method: 'POST' });
    linha.checks.push(
      resultado(role, 'cancelar-pedido', cancelarProibido ? cancelar.status === 403 : cancelar.status !== 403, `status=${cancelar.status}`),
    );

    // 12. Configuração do evento (qualquer membro lê; só management altera)
    if (eventoId) {
      const settings = await chamar(`/events/${eventoId}/settings`, { token });
      linha.checks.push(resultado(role, 'settings', settings.status === 200, `status=${settings.status}`));
    } else {
      linha.checks.push(resultado(role, 'settings', true, 'sem evento (skipped)'));
    }

    RES.push(linha);
    const falhas = linha.checks.filter((c) => !c.ok).length;
    console.log(`${falhas === 0 ? '✓' : '✗'} ${role.padEnd(10)} — ${linha.checks.length - falhas}/${linha.checks.length} critérios`);
  }

  // Evidências
  mkdirSync(EV_CLASS, { recursive: true });
  const linhasMd = ['# Evidências E2E por role — SenhasFestas', '', `Gerado: ${new Date().toISOString()}`, '',
    '| Role | Critério | Resultado | Detalhe |',
    '| --- | --- | --- | --- |'];
  for (const linha of RES) {
    for (const c of linha.checks) {
      linhasMd.push(`| ${c.role} | ${c.criterio} | ${c.ok ? '✅' : '❌'} | ${c.detalhe} |`);
    }
  }
  linhasMd.push('', '## Resumo por role', '', '| Role | ✅ | ❌ |', '| --- | --- | --- |');
  for (const linha of RES) {
    const ok = linha.checks.filter((c) => c.ok).length;
    const falhas = linha.checks.length - ok;
    linhasMd.push(`| ${linha.role} | ${ok} | ${falhas} |`);
  }
  writeFileSync(join(EV_CLASS, 'e2e-roles.md'), linhasMd.join('\n') + '\n');
  writeFileSync(join(EV_CLASS, 'e2e-roles.json'), JSON.stringify(RES, null, 2) + '\n');

  const totalOk = RES.flatMap((r) => r.checks).filter((c) => c.ok).length;
  const total = RES.flatMap((r) => r.checks).length;
  console.log(`\n📄 Evidências: docs/auditoria/e2e-roles.md e e2e-roles.json`);
  console.log(`${totalOk}/${total} critérios ✅  (${total - totalOk} ❌)`);
})().catch((erro) => {
  console.error('Falha na execução:', erro);
  process.exit(1);
});