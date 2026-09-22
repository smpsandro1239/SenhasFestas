#!/usr/bin/env node
/* E2E funcional — SenhasFestas
 * Cobre os requisitos funcionais de TODAS as roles, ponta-a-ponta, incluindo
 * os fluxos novos (deduct, accessCode, compra com saldo) e a regressão do
 * bug "FOR UPDATE nullable outer join" (compra com saldo -> 500).
 *
 * Uso:
 *   Exporta as credenciais das 7 contas antes de correr (zero segredos em código):
 *     E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 *     E2E_ORGANIZER_EMAIL / E2E_ORGANIZER_PASSWORD
 *     E2E_CASHIER_EMAIL / E2E_CASHIER_PASSWORD
 *     E2E_BAR_EMAIL / E2E_BAR_PASSWORD
 *     E2E_KITCHEN_EMAIL / E2E_KITCHEN_PASSWORD
 *     E2E_TREASURER_EMAIL / E2E_TREASURER_PASSWORD
 *     E2E_CLIENT_EMAIL / E2E_CLIENT_PASSWORD
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

const exigirEnv = (nome) => {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `Falta ${nome} no env. Este script não tem credenciais em código — ` +
        `exporta as E2E_*_EMAIL/E2E_*_PASSWORD antes de correr (ver topo do script).`,
    );
  }
  return valor;
};

const CONTAS = {
  superadmin: { email: exigirEnv('E2E_ADMIN_EMAIL'), password: exigirEnv('E2E_ADMIN_PASSWORD') },
  organizer: { email: exigirEnv('E2E_ORGANIZER_EMAIL'), password: exigirEnv('E2E_ORGANIZER_PASSWORD') },
  cashier: { email: exigirEnv('E2E_CASHIER_EMAIL'), password: exigirEnv('E2E_CASHIER_PASSWORD') },
  bar: { email: exigirEnv('E2E_BAR_EMAIL'), password: exigirEnv('E2E_BAR_PASSWORD') },
  kitchen: { email: exigirEnv('E2E_KITCHEN_EMAIL'), password: exigirEnv('E2E_KITCHEN_PASSWORD') },
  treasurer: { email: exigirEnv('E2E_TREASURER_EMAIL'), password: exigirEnv('E2E_TREASURER_PASSWORD') },
  client: { email: exigirEnv('E2E_CLIENT_EMAIL'), password: exigirEnv('E2E_CLIENT_PASSWORD') },
};

const EPS = 0.001;
const igual = (a, b) => Math.abs(a - b) < EPS;

const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

const cookieRefreshDe = (headers) => {
  const sc = headers?.get?.('set-cookie') || '';
  const m = /sf_refresh=([^;]+)/.exec(sc);
  return m ? decodeURIComponent(m[1]) : null;
};

const cookieSemDomain = (headers) => {
  const sc = headers?.get?.('set-cookie') || '';
  for (const parte of sc.split(',')) {
    if (/sf_(token|refresh)=/.test(parte) && /\bDomain=/i.test(parte)) {
      return false;
    }
  }
  return true;
};

async function chamar(path, { token, method = 'GET', body, cookie } = {}) {
  const tentar = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
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
      return { status: res.status, data, headers: res.headers };
    } catch (erro) {
      return { status: 0, data: { erro: erro.message }, headers: null };
    } finally {
      clearTimeout(timer);
    }
  };
  for (let tentativa = 1; ; tentativa++) {
    const r = await tentar();
    if (r.status === 429 && tentativa < 10) {
      await pausa(Math.min(1500 * tentativa, 10000));
      continue;
    }
    await pausa(70);
    return r;
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

  const loginCashierDetalhe = await chamar('/auth/login', {
    method: 'POST',
    body: { email: CONTAS.cashier.email, password: CONTAS.cashier.password },
  });
  const refreshCashier = cookieRefreshDe(loginCashierDetalhe.headers);
  check('auth', 'login-gera-refreshCookie', Boolean(refreshCashier), refreshCashier ? 'ok' : 'sem sf_refresh no Set-Cookie');
  check('auth', 'login-cookie-host-only-sem-domain', cookieSemDomain(loginCashierDetalhe.headers), 'ok', 'Domain presente no Set-Cookie');
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

  const lookupCodigo = await chamar(`/users/by-access-code/${accessCode}`, { token: token.cashier });
  const clienteEncontrado =
    lookupCodigo.status === 200 &&
    lookupCodigo.data?.id === clientId &&
    String(lookupCodigo.data?.accessCode ?? '') === accessCode;
  check('cashier', 'encontrar-cliente-por-codigo(endpoint-exato)', clienteEncontrado, `status=${lookupCodigo.status}`);
  const lookupInexistente = await chamar('/users/by-access-code/000000', { token: token.cashier });
  check('cashier', 'codigo-inexistente-devolve-404', lookupInexistente.status === 404, `status=${lookupInexistente.status}`);

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

  // ==================================================================
  // COBERTURA ADICIONAL — "deveria poder" (auth, históricos, relatórios,
  // membros, delivery por kitchen, cancel staff, gates não cobertos)
  // ==================================================================

  // ---- Auth: refresh e logout (via cookie httpOnly) ----
  let refreshCookie = `sf_refresh=${refreshCashier}`;
  const refreshR = await chamar('/auth/refresh', { method: 'POST', cookie: refreshCookie });
  check('auth', 'refresh-token', refreshR.status === 200 && Boolean(refreshR.data?.token), `status=${refreshR.status}`);
  const novoRefresh = cookieRefreshDe(refreshR.headers);
  if (novoRefresh) refreshCookie = `sf_refresh=${novoRefresh}`;
  const logoutR = await chamar('/auth/logout', { method: 'POST', cookie: refreshCookie });
  check('auth', 'logout', logoutR.status === 200, `status=${logoutR.status}`);

  // ---- Auth: registo self-service (client gera accessCode) ----
  const regEmail = `reg-${Date.now()}@senhasfestas.com`;
  const regR = await chamar('/auth/register', {
    method: 'POST',
    body: { email: regEmail, password: 'reg123456', name: 'E2E Registo' },
  });
  check(
    'client',
    'registar-self-service-com-accessCode',
    regR.status === 201 && Boolean(regR.data?.token) && /^\d{6}$/.test(regR.data?.user?.accessCode ?? ''),
    `status=${regR.status}`,
  );
  const buscaReg = await chamar(`/users?q=${regEmail.split('@')[0]}`, { token: token.superadmin });
  const regId = (Array.isArray(buscaReg.data) ? buscaReg.data : []).find((u) => u.email === regEmail)?.id;
  if (regId) {
    await chamar(`/users/${regId}`, { token: token.superadmin, method: 'DELETE' });
  }

  // ---- Client: pedidos próprios e histórico paginado ----
  const mineR = await chamar('/orders/mine', { token: token.client });
  check('client', 'orders-mine', mineR.status === 200 && Array.isArray(mineR.data?.items), `status=${mineR.status}`);
  const historyR = await chamar(`/balances/${clientId}/history?eventId=${eventoId}`, { token: token.client });
  check('client', 'historico-movimentos', historyR.status === 200 && Array.isArray(historyR.data), `status=${historyR.status}`);

  // ---- Staff: ver utilizador por id e pedidos de um evento ----
  const userById = await chamar(`/users/${clientId}`, { token: token.cashier });
  check('cashier', 'user-por-id', userById.status === 200 && userById.data?.id === clientId, `status=${userById.status}`);
  const ordersEvento = await chamar(`/orders/event/${eventoId}`, { token: token.cashier });
  check('cashier', 'orders-por-evento', ordersEvento.status === 200 && Array.isArray(ordersEvento.data?.items), `status=${ordersEvento.status}`);

  // ---- Relatórios (STAFF_FINANCE) ----
  const balSaldo = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.cashier });
  const balSaldoId = balSaldo.data?.id;
  const repOrdens = await chamar(`/reports/ordens?eventId=${eventoId}`, { token: token.cashier });
  check('cashier', 'relatorio-ordens', repOrdens.status === 200, `status=${repOrdens.status}`);
  const repSaldo = await chamar(`/reports/saldo?id=${balSaldoId}`, { token: token.cashier });
  check('cashier', 'relatorio-saldo', repSaldo.status === 200, `status=${repSaldo.status}`);
  const repTop = await chamar(`/reports/top-products?eventId=${eventoId}`, { token: token.cashier });
  check('cashier', 'relatorio-top-products', repTop.status === 200, `status=${repTop.status}`);
  const repEstat = await chamar('/reports/estatisticas', { token: token.treasurer });
  check('treasurer', 'relatorio-estatisticas', repEstat.status === 200, `status=${repEstat.status}`);

  // ---- Cancelamento com reembolso pelo staff (cashier) ----
  if (productId && preco > 0) {
    const balS = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.cashier });
    const saldoAntesS = Number(balS.data?.balance ?? 0);
    const usarS = Math.min(saldoAntesS, preco);
    const oS = await chamar('/orders', {
      token: token.cashier,
      method: 'POST',
      body: {
        eventId: eventoId,
        source: 'pos',
        tableNumber: 'E2E',
        paymentMethod: 'balance',
        balanceId: balS.data?.id,
        balanceUsed: usarS,
        items: [{ productId, quantity: 1 }],
      },
    });
    check('cashier', 'criar-pedido-como-staff', oS.status === 201, `status=${oS.status}`);
    const cancelS = await chamar(`/orders/${oS.data?.id}/cancel`, { token: token.cashier, method: 'POST' });
    check('cashier', 'cancelar-pedido-staff-reembolsa', cancelS.status === 200 || cancelS.status === 201, `status=${cancelS.status} ${cancelS.data?.message ?? ''}`);
    const balPosS = await chamar(`/balances/${clientId}?eventId=${eventoId}`, { token: token.cashier });
    const refundS = (balPosS.data?.movements ?? []).find((m) => m.type === 'refund' && Number(m.amount) === Number(usarS));
    check('cashier', 'reembolso-staff-quantia-certa', igual(Number(balPosS.data?.balance ?? 0), saldoAntesS), `esperado=${saldoAntesS.toFixed(2)} obtido=${Number(balPosS.data?.balance ?? 0).toFixed(2)}`);
    check('cashier', 'movimento-refund-staff', Boolean(refundS), refundS ? `amount=${refundS.amount}` : 'sem refund');
  } else {
    check('cashier', 'criar-pedido-como-staff', true, 'skipped');
    check('cashier', 'cancelar-pedido-staff-reembolsa', true, 'skipped');
    check('cashier', 'reembolso-staff-quantia-certa', true, 'skipped');
    check('cashier', 'movimento-refund-staff', true, 'skipped');
  }

  // ---- Kitchen pode marcar entregue (STAFF) + negados ----
  if (productId && preco > 0) {
    const oK = await chamar('/orders', {
      token: token.cashier,
      method: 'POST',
      body: {
        eventId: eventoId,
        source: 'pos',
        tableNumber: 'E2E',
        paymentMethod: 'cash',
        items: [{ productId, quantity: 1 }],
      },
    });
    const oKId = oK.data?.id;
    if (oKId) {
      await chamar(`/orders/${oKId}/status`, { token: token.kitchen, method: 'PATCH', body: { status: 'preparing' } });
      await chamar(`/orders/${oKId}/status`, { token: token.bar, method: 'PATCH', body: { status: 'ready' } });
      const deliverK = await chamar(`/public/pedidos/${oKId}/entregue`, { token: token.kitchen, method: 'PATCH' });
      check('kitchen', 'marcar-entregue-como-kitchen', deliverK.status === 200, `status=${deliverK.status} ${deliverK.data?.message ?? ''}`);
    } else {
      check('kitchen', 'marcar-entregue-como-kitchen', false, `sem id (status=${oK.status})`);
    }
  } else {
    check('kitchen', 'marcar-entregue-como-kitchen', true, 'skipped');
  }

  const prodPatchKitchen = await chamar(`/products/${productId}`, { token: token.kitchen, method: 'PATCH', body: { availability: 'unavailable' } });
  check('kitchen', 'nao-pode-gerir-produtos', prodPatchKitchen.status === 403, `status=${prodPatchKitchen.status}`);
  const prodPatchCashier = await chamar(`/products/${productId}`, { token: token.cashier, method: 'PATCH', body: { availability: 'unavailable' } });
  check('cashier', 'nao-pode-gerir-produtos', prodPatchCashier.status === 403, `status=${prodPatchCashier.status}`);
  const membrosBar = await chamar(`/events/${eventoId}/members`, { token: token.bar, method: 'POST', body: { userId: clientId, role: 'client' } });
  check('bar', 'nao-pode-gerir-membros', membrosBar.status === 403, `status=${membrosBar.status}`);

  // ---- Gestão de membros (organizer) ----
  const userTempM = await chamar('/users', {
    token: token.superadmin,
    method: 'POST',
    body: { email: `m-${Date.now()}@senhasfestas.com`, password: 'e2e12345', name: 'E2E Membro', role: 'bar' },
  });
  const tempMId = userTempM.data?.id;
  const listM = await chamar(`/events/${eventoId}/members`, { token: token.organizer });
  check('organizer', 'listar-membros', listM.status === 200 && Array.isArray(listM.data), `status=${listM.status}`);
  if (tempMId) {
    const addM = await chamar(`/events/${eventoId}/members`, { token: token.organizer, method: 'POST', body: { userId: tempMId, role: 'client' } });
    check('organizer', 'adicionar-membro', addM.status === 200 || addM.status === 201, `status=${addM.status}`);
    const listM2 = await chamar(`/events/${eventoId}/members`, { token: token.organizer });
    const presente = Array.isArray(listM2.data) && listM2.data.some((x) => x?.id === tempMId || x?.userId === tempMId);
    check('organizer', 'membro-aparece-na-lista', presente, `status=${listM2.status}`);
    const delM = await chamar(`/events/${eventoId}/members/${tempMId}`, { token: token.organizer, method: 'DELETE' });
    check('organizer', 'remover-membro', delM.status === 200, `status=${delM.status}`);
    await chamar(`/users/${tempMId}`, { token: token.superadmin, method: 'DELETE' });
  } else {
    check('organizer', 'adicionar-membro', false, 'sem user temp');
    check('organizer', 'membro-aparece-na-lista', true, 'skipped');
    check('organizer', 'remover-membro', true, 'skipped');
  }

  // ---- Superadmin: alterar role de utilizador; organizer negado ----
  const userTempP = await chamar('/users', {
    token: token.superadmin,
    method: 'POST',
    body: { email: `p-${Date.now()}@senhasfestas.com`, password: 'e2e12345', name: 'E2E Patch', role: 'cashier' },
  });
  const tempPId = userTempP.data?.id;
  if (tempPId) {
    const patchP = await chamar(`/users/${tempPId}`, { token: token.superadmin, method: 'PATCH', body: { role: 'treasurer' } });
    check('superadmin', 'mudar-role-utilizador', patchP.status === 200 && patchP.data?.role === 'treasurer', `status=${patchP.status}`);
    const patchPO = await chamar(`/users/${tempPId}`, { token: token.organizer, method: 'PATCH', body: { role: 'client' } });
    check('organizer', 'nao-pode-mudar-role', patchPO.status === 403, `status=${patchPO.status}`);
    await chamar(`/users/${tempPId}`, { token: token.superadmin, method: 'DELETE' });
  } else {
    check('superadmin', 'mudar-role-utilizador', false, 'sem user temp');
    check('organizer', 'nao-pode-mudar-role', true, 'skipped');
  }

  // ---- Endpoints públicos adicionais (sem token) ----
  const pubEvt = await chamar(`/public/evento?eventId=${eventoId}`);
  check('publico', 'evento-publico', pubEvt.status === 200, `status=${pubEvt.status}`);
  const pubProntos = await chamar(`/public/pedidos-prontos?eventId=${eventoId}`);
  check('publico', 'pedidos-prontos-publico', pubProntos.status === 200, `status=${pubProntos.status}`);
  const pubPrep = await chamar(`/public/pedidos-em-preparacao?eventId=${eventoId}`);
  check('publico', 'pedidos-preparacao-publico', pubPrep.status === 200, `status=${pubPrep.status}`);
  const pubCnt = await chamar(`/public/contagem?eventId=${eventoId}`);
  check('publico', 'contagem-publico', pubCnt.status === 200, `status=${pubCnt.status}`);

  // ---- Gate destrutivo: apagar evento só superadmin (último, por segurança) ----
  const delEvtO = await chamar(`/events/${eventoId}`, { token: token.organizer, method: 'DELETE' });
  check('organizer', 'nao-pode-apagar-evento-superadmin-so', delEvtO.status === 403, `status=${delEvtO.status}`);

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