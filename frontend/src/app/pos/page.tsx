'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SearchIcon, QrIcon, CheckIcon, ArrowLeftIcon, MinusIcon, PlusIcon, CloseIcon } from '@/components/ui/icons';
import { useAuth } from '@/lib/auth-context';
import { useCurrentEvent } from '@/lib/use-current-event';
import { useOrderSocket } from '@/lib/use-order-socket';
import { getProducts, getBalance, createOrder, getBalanceHistory, getOrdersByEvent } from '@/lib/api';
import { esgotado, podeAdicionar } from '@/lib/stock';

const MESAS_CHIPS = ['', '1', '2', '3', '4', '5', '6'] as const;

const posStatusMeta: Record<string, { label: string; cls: string }> = {
  received: { label: 'Recebido', cls: 'text-orange-400' },
  preparing: { label: 'A preparar', cls: 'text-brand-light' },
  ready: { label: 'Pronto', cls: 'text-emerald-400' },
};

// Aviso sonoro sem asset: oscilador curto. Se o autoplay não aceitar som sem
// interação do utilizador, fica só o banner — o POS é operado num tablet com
// toques constantes, portanto costuma funcionar.
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch {
    // sem áudio disponível: silêncio
  }
}

export default function PO_webp_placeOrder() {
  return (
    <Suspense fallback={null}>
      <POSPage />
    </Suspense>
  );
}

function POSPage() {
  const searchParams = useSearchParams();
  const { event, loading: eventLoading } = useCurrentEvent();
  const eventId = searchParams.get('event') ?? searchParams.get('e') ?? event?.id ?? '';
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [balance, setBalance] = useState<{ id?: string; balance?: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<any[]>([]);
  const [mesa, setMesa] = useState('');
  const [pagamento, setPagamento] = useState<'saldo' | 'dinheiro'>('saldo');
  const [recebido, setRecebido] = useState('');
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [readyAlert, setReadyAlert] = useState<any>(null);
  const [alertArmed, setAlertArmed] = useState(false);
  const seenReady = useRef<Set<string>>(new Set());

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getProducts(eventId ? { eventId } : undefined);
      setProducts(Array.isArray(data) ? data : data?.items ?? []);
    } catch {
      setError('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId || eventLoading) return;
    fetchProducts();
  }, [fetchProducts, eventId, eventLoading]);

  useEffect(() => {
    if (!user) return;
    getBalance(user.id, eventId || undefined)
      .then((b) => setBalance(b ?? null))
      .catch(() => setBalance(null));
  }, [user, eventId]);

  const fetchOpenOrders = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await getOrdersByEvent(eventId);
      const list = ((data?.items ?? data) as any[]).filter((o: any) =>
        ['received', 'preparing', 'ready'].includes(o.status),
      );
      setOpenOrders(list);
      if (alertArmed) {
        const prontos = list.filter((o: any) => o.status === 'ready');
        const novos = prontos.filter((o: any) => !seenReady.current.has(o.id));
        if (novos.length > 0) {
          setReadyAlert(novos[novos.length - 1]);
          beep();
        }
      }
      seenReady.current = new Set(list.filter((o: any) => o.status === 'ready').map((o: any) => o.id));
    } catch {
      // painel de orders abertas é acessório; o POS continua a vender
    }
  }, [eventId, alertArmed]);

  const { status: socketStatus } = useOrderSocket(fetchOpenOrders, eventId);

  useEffect(() => {
    if (!eventId) return;
    fetchOpenOrders();
    const interval = setInterval(fetchOpenOrders, 4000);
    return () => clearInterval(interval);
  }, [fetchOpenOrders, eventId]);

  useEffect(() => {
    const t = setTimeout(() => setAlertArmed(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    setFiltered(
      q
        ? products.filter((p: any) =>
            [p.name, p.description, p.category].filter(Boolean).join(' ').toLowerCase().includes(q),
          )
        : products,
    );
  }, [products, query]);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const noCarrinho = prev.find((i) => i.id === product.id)?.quantity ?? 0;
      if (!podeAdicionar(product, noCarrinho)) return prev;
      const existing = prev.find((i) => i.id === product.id);
      return existing
        ? prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeOne = (id: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item && item.quantity > 1) return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
      return prev.filter((i) => i.id !== id);
    });
  };

  const cartTotal = cart.reduce((s, i) => s + (Number(i.price) || 0) * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const recebidoNum = Number(recebido) || 0;
  const troco = pagamento === 'dinheiro' ? Math.max(recebidoNum - cartTotal, 0) : 0;

  const handlePlace = async () => {
    if (!cart.length || !eventId) return;
    setPlacing(true);
    setError('');
    try {
      const snapshot = cart.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity }));
      await createOrder({
        eventId,
        source: 'pos',
        tableNumber: mesa || undefined,
        items: snapshot.map((i) => ({ productId: i.id, quantity: i.quantity })),
        paymentMethod: pagamento === 'dinheiro' ? 'cash' : 'balance',
        balanceId: pagamento === 'dinheiro' ? undefined : balance?.id,
        balanceUsed: pagamento === 'dinheiro' ? undefined : balance?.id ? balance.balance ?? 0 : 0,
      });
      setPlaced(snapshot);
      setCart([]);
      if (pagamento === 'dinheiro') {
        setRecebido('');
      } else {
        setBalance((prev) => (prev ? { ...prev, balance: Math.max((prev.balance ?? 0) - cartTotal, 0) } : prev));
      }
      fetchProducts();
      fetchOpenOrders();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar o pedido');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Ponto de Venda"
        subtitle={event?.name ? `Venda direta • ${event.name}` : 'Venda direta (sem carrinho partilhado)'}
        icon={<QrIcon className="h-5 w-5" />}
      />

      {placed.length > 0 && (
        <div className="mx-auto w-full max-w-lg px-4 mb-4">
          <Alert
            variant="success"
            title="Pedido lançado"
            message={`${placed.reduce((s, i) => s + i.quantity, 0)} artigo(s) para a cozinha.`}
          />
        </div>
      )}

      {readyAlert && (
        <div className="mx-auto w-full max-w-lg px-4 mb-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 animate-fade-in">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <CheckIcon className="h-5 w-5" />
                  Pedido pronto para entrega
                </div>
                <p className="text-sm text-zinc-200 mt-1">
                  Pedido #{readyAlert.id?.slice(-4)}
                  {readyAlert.tableNumber ? ` • Mesa ${readyAlert.tableNumber}` : ''} •{' '}
                  <span className="font-mono">€{Number(readyAlert.total ?? 0).toFixed(2)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReadyAlert(null)}
                aria-label="Fechar aviso"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface transition-colors"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-lg px-4 space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-sm font-medium text-zinc-400">Mesa</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMesa('')}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors',
                mesa === ''
                  ? 'bg-brand text-black border-brand'
                  : 'bg-surface-solid border-border text-zinc-300 hover:bg-surface-hover',
              )}
            >
              Balcão
            </button>
            {MESAS_CHIPS.filter((m) => m !== '').map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMesa(m)}
                className={cn(
                  'min-w-[2.5rem] rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors',
                  mesa === m
                    ? 'bg-brand text-black border-brand'
                    : 'bg-surface-solid border-border text-zinc-300 hover:bg-surface-hover',
                )}
              >
                {m}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={99}
              value={/^\d+$/.test(mesa) && mesa.length > 0 && !MESAS_CHIPS.includes(mesa as any) ? mesa : ''}
              onChange={(e) => setMesa(e.target.value)}
              placeholder="Nº mesa…"
              aria-label="Número de mesa personalizado"
              className="w-24 rounded-xl border border-border bg-surface-solid px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-sm font-medium text-zinc-400">Pagamento</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setPagamento('saldo')}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                pagamento === 'saldo'
                  ? 'bg-brand text-black border-brand'
                  : 'bg-surface-solid border-border text-zinc-300 hover:bg-surface-hover',
              )}
            >
              Saldo do cartão
            </button>
            <button
              type="button"
              onClick={() => setPagamento('dinheiro')}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                pagamento === 'dinheiro'
                  ? 'bg-brand text-black border-brand'
                  : 'bg-surface-solid border-border text-zinc-300 hover:bg-surface-hover',
              )}
            >
              Dinheiro
            </button>
          </div>
          {pagamento === 'dinheiro' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Input
                type="number"
                step="0.01"
                min={0}
                label="Valor recebido"
                value={recebido}
                onChange={(e) => setRecebido(e.target.value)}
                placeholder="0.00"
              />
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Troco</label>
                <div className={cn('rounded-xl px-4 py-2.5 text-sm font-bold border', troco > 0 ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5' : 'text-zinc-400 border-border bg-surface-solid')}>
                  €{troco.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {openOrders.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-400">
                Em aberto <span className="text-zinc-500">({openOrders.length})</span>
              </div>
              <span
                title="Estado da ligação em tempo real"
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                  socketStatus === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : socketStatus === 'reconnecting'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-red-500/10 text-red-400 border-red-500/30',
                )}
              >
                {socketStatus === 'connected' ? 'Ligado' : 'Polling'}
              </span>
            </div>
            <div className="mt-2 space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(
                openOrders.reduce((acc: Record<string, { items: any[]; total: number }>, o: any) => {
                  const chave = o.tableNumber || 'Balcão';
                  acc[chave] = acc[chave] ?? { items: [], total: 0 };
                  acc[chave].items.push(o);
                  acc[chave].total += Number(o.total) || 0;
                  return acc;
                }, {}),
              ).map(([nomeMesa, g]: [string, { items: any[]; total: number }]) => (
                <div key={nomeMesa} className="rounded-xl border border-border bg-surface-solid p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">Mesa {nomeMesa}</span>
                    <span className="text-sm font-bold text-brand-light">€{g.total.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {g.items.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-zinc-400">
                          #{o.id.slice(-4)}
                          <span className="mx-1 text-zinc-600">·</span>
                          {o.items?.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0)} art.
                        </span>
                        <span className={cn('font-semibold', posStatusMeta[o.status]?.cls ?? 'text-zinc-400')}>
                          {posStatusMeta[o.status]?.label ?? o.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Input
          label="Pesquisar produto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, descrição ou categoria…"
          icon={<SearchIcon className="h-4 w-4" />}
        />

        {error && <Alert variant="error" message={error} />}

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-24 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Alert variant="info" message={query ? 'Sem resultados para a pesquisa.' : 'Nenhum produto disponível de momento.'} />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((product: any) => {
              const item = cart.find((i) => i.id === product.id);
              const qty = item?.quantity ?? 0;
              const sem = esgotado(product);
              const podeMais = podeAdicionar(product, qty);
              return (
                <div
                  key={product.id}
                  className={cn(
                    'flex items-center gap-4 rounded-2xl border p-4 transition-all',
                    qty > 0 ? 'bg-brand/5 border-brand/30' : sem ? 'bg-surface border-border opacity-70' : 'bg-surface border-border',
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-zinc-100">{product.name}</h3>
                      <span className="text-sm font-bold text-brand-light">€{Number(product.price).toFixed(2)}</span>
                    </div>
                    {product.description && (
                      <p className="mt-0.5 text-sm text-zinc-400 line-clamp-2">{product.description}</p>
                    )}
                    {sem && (
                      <span className="inline-block mt-1.5 rounded-full bg-red-500/15 text-red-300 text-[10px] font-semibold px-2 py-0.5">
                        Esgotado
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    {qty > 0 && (
                      <button
                        type="button"
                        onClick={() => removeOne(product.id)}
                        aria-label={`Remover um ${product.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-zinc-300 hover:bg-surface-hover transition-colors"
                      >
                        <MinusIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className={cn('w-5 text-center text-sm font-semibold', qty > 0 ? 'text-zinc-100' : 'text-transparent')}>{qty}</span>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={!podeMais}
                      aria-label={sem ? `${product.name} esgotado` : `Adicionar ${product.name}`}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-black hover:bg-brand-hover transition-colors',
                        !podeMais && 'opacity-40 cursor-not-allowed hover:bg-brand/70',
                      )}
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {cartCount > 0 && (
          <div className="sticky bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
            {pagamento === 'dinheiro' && recebidoNum > 0 && recebidoNum < cartTotal && (
              <div className="mb-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                Faltam €{(cartTotal - recebidoNum).toFixed(2)} para completar o total.
              </div>
            )}
            <Button
              size="lg"
              fullWidth
              onClick={handlePlace}
              loading={placing}
              disabled={!eventId || (pagamento === 'dinheiro' && recebidoNum > 0 && recebidoNum < cartTotal)}
              className="mb-4 justify-between"
            >
              <span>{placing ? 'A lançar…' : `Lançar ${cartCount} artigos`}</span>
              <span className="text-lg font-bold">
                {pagamento === 'dinheiro'
                  ? troco > 0
                    ? `Troco €${troco.toFixed(2)}`
                    : `€${cartTotal.toFixed(2)} em dinheiro`
                  : `€${cartTotal.toFixed(2)}`}
              </span>
            </Button>
          </div>
        )}

        {!eventId && (
          <p className="pb-2 text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
              <ArrowLeftIcon className="h-4 w-4" />
              Voltar ao menu
            </Link>
          </p>
        )}
      </div>
    </AppShell>
  );
}
