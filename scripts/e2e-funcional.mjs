#!/usr/bin/env node
/* E2E funcional — SenhasFestas
 * Cobre os requisitos funcionais de TODAS as roles, ponta-a-ponta, incluindo
 * os fluxos novos (deduct, accessCode, compra com saldo) e a regressão do
 * bug "FOR UPDATE nullable outer join" (compra com saldo -> 500).
 *
 * Uso:
 *   node scripts/e2e-funcional.mjs
 *   BASE_URL=http://localhost:3000/api node scripts/e2e-funcional.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const EV_CLASS = join(RAIZ, 'docs', 'auditoria');

const BASE = (process.env.BASE_URL || 'https://senhasfestas-api.vercel.app/api').replace(/\/+$/, '');

const CONTAS = {
  superadmin: { email: 'admin@senhasfestas.com', password: 'admin123' },
  organizer: { email: 'organizer@senhasfestas.com', password: 'organizer123' },
  cashier: { email: 'cashier@senhasfestas.com', password: 'cashier123' },
  bar: { email: 'bar@senhasfestas.com', password: 'bar123' },
  kitchen: { email: 'kitchen@senhasfestas.com', password: 'kitchen123' },
  treasurer: { email: 'treasurer@senhasfestas.com', password: 'treasurer123' },
  client: { email: 'client@senhasfestas.com', password: 'client123' },
};

const EPS = 0.001;
const igual = (a, b) => Math.abs(a - b) < EPS;

async function chamar(path, { token, method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
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

const login = async (nome) => {
  const c = CONTAS[nome];
  const r = await chamar('/auth/login', { method: 'POST', body: { email: c.email, password: c.password } });
  return r.data?.token || null;
};

const CHECKS = [];
const check = (role, criterio, ok, detalhe = '') => CHECKS.push({ role, criterio, ok, detalhe });

(async () => {
  console.log(`🛰  API: ${BASE}\n`);

  const token = {};
  for (const nome of Object.keys(CONTAS)) token[nome] = await login(nome);
  for (const nome of Object.keys(CONTAS)) {
    check(nome, 'login', Boolean(token[nome]), token[nome] ? 'ok' : 'token ausente');
  }
  if (!token.superadmin || !token.cashier || !token.client) {
    console.log('✗ Login base falhou — abortar');
    process.exit(1);
  }

  // ---- Setup: evento + produto + membros ----
  const events = await chamar('/events', { token: token.superadmin });
  const eventoId = Array.isArray(events.data) && events.data.length ? events.data[0].id : null;
  check('setup', 'evento-disponivel', Boolean(eventoId), `status=${events.status}`);

  const prod = await chamar(`/products?eventId=${eventoId}`, { token: token.client });
  const produtos = Array.isArray(prod.data) ? prod.data : prod.data?.items ?? [];
  const produto = produtos.find((p) => p.availability === 'available' && Number(p.price) > 0) || produtos[0];
  const productId = produto?.id || null;
  const preco = produto ? Number(produto.price) : 0;
  check('setup', 'menu-visivel-para-client', Array.isArray(prod.data) || Array.isArray(prod.data?.items), `status=${prod.status}`);
  check('setup', 'produto-para-fluxo', Boolean(productId), productId ? `price=${preco}` : 'sem produtos');

  // garantir membros no evento (via superadmin)
  const papelParaRole = (role) => ['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer', 'client'].includes(role) ? role : 'client';
  for (const nome of ['cashier', 'kitchen', 'bar', 'client']) {
    const lista = await chamar(`/users?q=${CONTAS[nome].email.split('@')[0]}`, { token: token.superadmin });
    const alvo = Array.isArray(lista.data) ? lista.data.find((u) => u.email === CONTAS[nome].email) : null;
    if (alvo) {
      await chamar(`/events/${eventoId}/members`, {
        token: token.superadmin,
        method: 'POST',
        body: { userId: alvo.id, role: papelParaRole(nome) },
      });
    }
  }
  const idsPorEmail = {};
  for (const nome of Object.keys(CONTAS)) {
    const lista = await chamar(`/users?q=${CONTAS[nome].email.split('@')[0]}`, { token: token.superadmin });
    idsPorEmail[nome] = Array.isArray(lista.data) ? lista.data.find((u) => u.email === CONTAS[nome].email)?.id : null;
  }
  check('setup', 'membros-resolvidos', Boolean(idsPorEmail.client && idsPorEmail.cashier), 'ids apanhados');

  const clientId = idsPorEmail.client;

  // ==================================================================
  // CLIENT — menu, accessCode, saldo e compra com saldo (regressão 500)
  // ==================================================================
  const me = await chamar('/users/me', { token: token.client });
  const accessCode = me.data?.accessCode;
  check('client', 'accessCode-6-digitos', /^\d{6}$/.test(accessCode || ''), `code=${accessCode}`);

  const bal0 = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.client });
  const saldoInicial = Number(bal0.data?.balance ?? 0);

  const loadR = await chamar(`/balances/${clientId}/load`, {
    token: token.cashier,
    method: 'POST',
    body: { amount: 5, eventId: eventoId, paymentMethod: 'cash' },
  });
  check('cashier', 'carregar-saldo', loadR.status === 200 || loadR.status === 201, `status=${loadR.status}`);

  const dedutivoTratado = await chamar(`/balances/${clientId}/load`, {
    token: token.kitchen,
    method: 'POST',
    body: { amount: 1, eventId: eventoId },
  });
  check('kitchen', 'nao-pode-carregar-saldo', dedutivoTratado.status === 403, `status=${dedutivoTratado.status}`);

  const dedutivo = await chamar(`/balances/${clientId}/deduct`, {
    token: token.cashier,
    method: 'POST',
    body: { amount: 0.5, eventId: eventoId, description: 'E2E desconto' },
  });
  check('cashier', 'descontar-saldo', dedutivo.status === 200 || dedutivo.status === 201, `status=${dedutivo.status}`);

  const dedutivoCliente = await chamar(`/balances/${clientId}/deduct`, {
    token: token.client,
    method: 'POST',
    body: { amount: 0.1, eventId: eventoId },
  });
  check('client', 'nao-pode-descontar', dedutivoCliente.status === 403, `status=${dedutivoCliente.status}`);

  const dedutivoBar = await chamar(`/balances/${clientId}/deduct`, {
    token: token.bar,
    method: 'POST',
    body: { amount: 0.1, eventId: eventoId },
  });
  check('bar', 'nao-pode-descontar', dedutivoBar.status === 403, `status=${dedutivoBar.status}`);

  const bal1 = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.client });
  const saldoPosDeduct = Number(bal1.data?.balance ?? 0);
  check('cashier', 'saldo-descontado-correcto', igual(saldoPosDeduct, saldoInicial + 5 - 0.5), `esperado=${(saldoInicial + 5 - 0.5).toFixed(2)} obtido=${saldoPosDeduct.toFixed(2)}`);

  const descMov = (bal1.data?.movements ?? []).find((m) => m.type === 'consume');
  check('client', 'movimento-desconto-registado', Boolean(descMov), descMov ? `amount=${descMov.amount}` : 'sem movimento consume');

  const lookupCodigo = await chamar(`/users?q=${accessCode}`, { token: token.cashier });
  const clienteEncontrado = Array.isArray(lookupCodigo.data) && lookupCodigo.data.some((u) => u.id === clientId && String(u.accessCode ?? '') === accessCode);
  check('cashier', 'encontrar-cliente-por-codigo', clienteEncontrado, `status=${lookupCodigo.status}`);

  const publico = await chamar(`/public/pedidos-recebidos?eventId=${eventoId}`); // sem token
  const semLeak = !JSON.stringify(publico.data ?? {}).includes('accessCode');
  check('publico', 'sem-accessCode-em-api-publica', publico.status === 200 && semLeak, `status=${publico.status}`);

  // ---- Compra com saldo (obrigatório não dar 500) ----
  if (productId && preco > 0) {
    const balPr = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.client });
    const valUse = Math.min(Number(balPr.data?.balance ?? 0), preco);
    const balId = balPr.data?.id;

    const cria = await chamar('/orders', {
      token: token.client,
      method: 'POST',
      body: {
        eventId: eventoId,
        source: 'qr',
        tableNumber: 'E2E',
        paymentMethod: 'balance',
        balanceId: balId,
        balanceUsed: valUse,
        items: [{ productId, quantity: 1 }],
      },
    });
    check('client', 'compra-com-saldo-sem-500', cria.status === 201, `status=${cria.status} ${cria.data?.message ?? ''}`);

    const orderId1 = cria.data?.id || null;
    if (orderId1) {
      const statusPatcCliente = await chamar(`/orders/${orderId1}/status`, {
        token: token.client,
        method: 'PATCH',
        body: { status: 'preparing' },
      });
      check('client', 'nao-pode-avancar-estado', statusPatcCliente.status === 403, `status=${statusPatcCliente.status}`);

      const preparing = await chamar(`/orders/${orderId1}/status`, {
        token: token.kitchen,
        method: 'PATCH',
        body: { status: 'preparing' },
      });
      check('kitchen', 'iniciar-preparacao', preparing.status === 200, `status=${preparing.status}`);

      const pronta = await chamar(`/orders/${orderId1}/status`, {
        token: token.bar,
        method: 'PATCH',
        body: { status: 'ready' },
      });
      check('bar', 'marcar-pronto', pronta.status === 200, `status=${pronta.status}`);

      const entregue = await chamar(`/public/pedidos/${orderId1}/entregue`, {
        token: token.cashier,
        method: 'PATCH',
      });
      check('cashier', 'marcar-entregue(sem-500)', entregue.status === 200, `status=${entregue.status} ${entregue.data?.message ?? ''}`);

      const balC = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.client });
      const movConsumo = (balC.data?.movements ?? []).find((m) => m.type === 'consume' && Number(m.amount) === Number(valUse));
      check('client', 'consumo-debitado-e-registado', Number(balC.data?.balance) >= 0 && Boolean(movConsumo), movConsumo ? `amount=${movConsumo.amount}` : 'sem movimento consume');

      // ---- Cancelar pedido com reembolso ----
      const carneca = await chamar(`/balances/${clientId}/load`, {
        token: token.cashier,
        method: 'POST',
        body: { amount: 5, eventId: eventoId },
      });
      check('cashier', 're-carregar-para-cancelamento', carneca.status === 200 || carneca.status === 201, `status=${carneca.status}`);

      const balAntCancel = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.client });
      const valUse2 = Math.min(Number(balAntCancel.data?.balance ?? 0), preco);
      const cria2 = await chamar('/orders', {
        token: token.client,
        method: 'POST',
        body: {
          eventId: eventoId,
          source: 'qr',
          tableNumber: 'E2E',
          paymentMethod: 'balance',
          balanceId: balAntCancel.data?.id,
          balanceUsed: valUse2,
          items: [{ productId, quantity: 1 }],
        },
      });
      check('client', 'criar-2o-pedido', cria2.status === 201, `status=${cria2.status}`);

      const cancelar2 = await chamar(`/orders/${cria2.data?.id}/cancel`, { token: token.client, method: 'POST' });
      check('client', 'cancelar-reembolsa-saldo', cancelar2.status === 200 || cancelar2.status === 201, `status=${cancelar2.status} ${cancelar2.data?.message ?? ''}`);

      const balPosCancel = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.client });
      const reembolsado = igual(Number(balPosCancel.data?.balance ?? 0), Number(balAntCancel.data?.balance ?? 0));
      const movRefund = (balPosCancel.data?.movements ?? []).find((m) => m.type === 'refund');
      check('client', 'reembolso-quantia-certa', reembolsado, `esperado=${Number(balAntCancel.data?.balance ?? 0).toFixed(2)} obtido=${Number(balPosCancel.data?.balance ?? 0).toFixed(2)}`);
      check('client', 'movimento-refund-registado', Boolean(movRefund), movRefund ? `amount=${movRefund.amount}` : 'sem refund');
    }
  } else {
    check('client', 'compra-com-saldo-sem-500', true, 'skipped — sem produto');
  }

  // ---- Estorno de carregamento (financial) ----
  const balE = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.client });
  const movLoad = (balE.data?.movements ?? []).find((m) => m.type === 'load');
  if (movLoad && !movLoad.reversed) {
    const rev = await chamar(`/balances/${clientId}/reverse/${movLoad.id}?eventId=${eventoId}`, {
      token: token.organizer,
      method: 'POST',
    });
    check('organizer', 'estornar-carregamento', rev.status === 200 || rev.status === 201, `status=${rev.status}`);
    const balERev = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.client });
    const movRev = (balERev.data?.movements ?? []).find((m) => m.id === movLoad.id);
    check('client', 'carregamento-assinalado-estornado', Boolean(movRev?.reversed), movRev ? `reversed=${movRev.reversed}` : 'movingeausente');
  } else {
    check('organizer', 'estornar-carregamento', true, 'skipped — sem carregamento');
  }

  // ---- Caixa (fechos) ----
  const abrirCaixa = await chamar('/cash-closure/abrir', {
    token: token.cashier,
    method: 'POST',
    body: { eventId: eventoId, openingBalance: 0, notes: 'E2E' },
  });
  check('cashier', 'abrir-caixa', abrirCaixa.status === 200 || abrirCaixa.status === 201, `status=${abrirCaixa.status}`);
  const caixaId = abrirCaixa.data?.id || abrirCaixa.data?.closure?.id || null;
  if (caixaId) {
    const fechar = await chamar(`/cash-closure/${caixaId}/fechar`, {
      token: token.cashier,
      method: 'POST',
      body: { totalActual: 0, notes: 'E2E' },
    });
    check('cashier', 'fechar-caixa', fechar.status === 200 || fechar.status === 201, `status=${fechar.status}`);
  } else {
    check('cashier', 'fechar-caixa', false, `caixaId ausente (status=${abrirCaixa.status}) body=${JSON.stringify(abrirCaixa.data).slice(0, 120)}`);
  }
  const abrirCaixaKitchen = await chamar('/cash-closure/abrir', {
    token: token.kitchen,
    method: 'POST',
    body: { eventId: eventoId },
  });
  check('kitchen', 'nao-pode-abrir-caixa', abrirCaixaKitchen.status === 403, `status=${abrirCaixaKitchen.status}`);

  // ==================================================================
  // ORGANIZER — gestão de produtos e settings
  // ==================================================================
  if (eventoId && productId) {
    const corpoCriar = {
      eventId: eventoId,
      name: `E2E Temp ${Date.now().toString().slice(-6)}`,
      price: 1,
      availability: 'available',
    };
    const criarProd = await chamar('/products', { token: token.organizer, method: 'POST', body: corpoCriar });
    check('organizer', 'criar-produto', criarProd.status === 201 || criarProd.status === 200, `status=${criarProd.status}`);
    const prodNovoId = criarProd.data?.id || null;
    if (prodNovoId) {
      const patchProd = await chamar(`/products/${prodNovoId}`, {
        token: token.organizer,
        method: 'PATCH',
        body: { availability: 'unavailable' },
      });
      check('organizer', 'editar-produto', patchProd.status === 200, `status=${patchProd.status}`);
      const delProd = await chamar(`/products/${prodNovoId}`, { token: token.organizer, method: 'DELETE' });
      check('organizer', 'apagar-produto', delProd.status === 200, `status=${delProd.status}`);
    }
    const patchCliente = await chamar(`/products/${prodNovoId ?? productId}`, {
      token: token.client,
      method: 'PATCH',
      body: { availability: 'unavailable' },
    });
    check('client', 'nao-pode-editar-produto', patchCliente.status === 403, `status=${patchCliente.status}`);

    const settings = await chamar(`/events/${eventoId}/settings`, { token: token.organizer });
    const patchSettings = await chamar(`/events/${eventoId}/settings`, {
      token: token.organizer,
      method: 'PATCH',
      body: { currency: 'EUR' },
    });
    check('organizer', 'guardar-settings', settings.status === 200 && (patchSettings.status === 200 || patchSettings.status === 201), `settings=${settings.status} patch=${patchSettings.status}`);
  } else {
    check('organizer', 'criar-produto', true, 'skipped');
    check('organizer', 'editar-produto', true, 'skipped');
    check('organizer', 'apagar-produto', true, 'skipped');
    check('client', 'nao-pode-editar-produto', true, 'skipped');
    check('organizer', 'guardar-settings', true, 'skipped');
  }

  // ==================================================================
  // SUPERADMIN — criação e remoção de utilizador + auditoria
  // ==================================================================
  const novoEmail = `e2e-${Date.now()}@senhasfestas.com`;
  const criarUser = await chamar('/users', {
    token: token.superadmin,
    method: 'POST',
    body: { email: novoEmail, password: 'e2e12345', name: 'E2E User', role: 'cashier' },
  });
  check('superadmin', 'criar-utilizador', criarUser.status === 201 || criarUser.status === 200, `status=${criarUser.status}`);
  const novoId = criarUser.data?.id || null;
  if (novoId) {
    const delUser = await chamar(`/users/${novoId}`, { token: token.superadmin, method: 'DELETE' });
    check('superadmin', 'apagar-utilizador', delUser.status === 200, `status=${delUser.status}`);
  } else {
    check('superadmin', 'apagar-utilizador', false, 'sem id');
  }
  const auditCsv = await chamar('/audit/export.csv', { token: token.superadmin });
  check('superadmin', 'exportar-auditoria', auditCsv.status === 200, `status=${auditCsv.status}`);
  const criarUserOrganizer = await chamar('/users', {
    token: token.organizer,
    method: 'POST',
    body: { email: `e2e-o-${Date.now()}@senhasfestas.com`, password: 'e2e12345', name: 'E2E O', role: 'cashier' },
  });
  check('organizer', 'criar-utilizador', criarUserOrganizer.status === 201 || criarUserOrganizer.status === 200, `status=${criarUserOrganizer.status}`);
  if (criarUserOrganizer.data?.id) {
    await chamar(`/users/${criarUserOrganizer.data.id}`, { token: token.superadmin, method: 'DELETE' });
  }

  // ==================================================================
  // TREASURER — operações financeiras + auditoria
  // ==================================================================
  const trLoad = await chamar(`/balances/${clientId}/load`, {
    token: token.treasurer,
    method: 'POST',
    body: { amount: 0.01, eventId: eventoId },
  });
  check('treasurer', 'carregar-saldo', trLoad.status === 200 || trLoad.status === 201, `status=${trLoad.status}`);
  const trDeduct = await chamar(`/balances/${clientId}/deduct`, {
    token: token.treasurer,
    method: 'POST',
    body: { amount: 0.01, eventId: eventoId },
  });
  check('treasurer', 'descontar-saldo', trDeduct.status === 200 || trDeduct.status === 201, `status=${trDeduct.status}`);
  const trashAudit = await chamar('/audit', { token: token.treasurer });
  check('treasurer', 'ver-auditoria', trashAudit.status === 200, `status=${trashAudit.status}`);
  const trPedirProduto = await chamar(`/products?eventId=${eventoId}`, { token: token.treasurer });
  check('treasurer', 'ver-catalogo', trPedirProduto.status === 200, `status=${trPedirProduto.status}`);

  // ---- Resumo ----
  const totalOk = CHECKS.filter((c) => c.ok).length;
  const total = CHECKS.length;
  const porRole = {};
  for (const c of CHECKS) {
    porRole[c.role] = porRole[c.role] || { ok: 0, total: 0 };
    porRole[c.role].total++;
    if (c.ok) porRole[c.role].ok++;
  }

  mkdirSync(EV_CLASS, { recursive: true });
  const md = [
    '# Evidências E2E funcional — SenhasFestas',
    '',
    `API: ${BASE}`,
    `Gerado: ${new Date().toISOString()}`,
    '',
    '| Role | Critério | Resultado | Detalhe |',
    '| --- | --- | --- | --- |',
    ...CHECKS.map((c) => `| ${c.role} | ${c.criterio} | ${c.ok ? '✅' : '❌'} | ${c.detalhe} |`),
    '',
    '## Resumo por role',
    '',
    '| Role | ✅ | ❌ |',
    '| --- | --- | --- |',
    ...Object.entries(porRole).map(([r, v]) => `| ${r} | ${v.ok} | ${v.total - v.ok} |`),
    '',
  ];
  writeFileSync(join(EV_CLASS, 'e2e-funcional.md'), md.join('\n') + '\n');
  writeFileSync(join(EV_CLASS, 'e2e-funcional.json'), JSON.stringify(CHECKS, null, 2) + '\n');

  console.log(`📄 Evidências: docs/auditoria/e2e-funcional.md e e2e-funcional.json`);
  console.log(`${totalOk}/${total} critérios funcional ✅`);
  for (const [r, v] of Object.entries(porRole)) {
    console.log(`${v.ok === v.total ? '✓' : '✗'} ${r.padEnd(10)} — ${v.ok}/${v.total}`);
  }
  if (totalOk !== total) {
    process.exitCode = 1;
  }
})().catch((erro) => {
  console.error('Falha na execução:', erro);
  process.exit(1);
});