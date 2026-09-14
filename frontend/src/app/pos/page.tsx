'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SearchIcon, QrIcon, CheckIcon, ArrowLeftIcon, MinusIcon, PlusIcon } from '@/components/ui/icons';
import { useAuth } from '@/lib/auth-context';
import { useCurrentEvent } from '@/lib/use-current-event';
import { getProducts, getBalance, createOrder, getBalanceHistory } from '@/lib/api';

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

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getProducts(eventId || undefined);
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

  const handlePlace = async () => {
    if (!cart.length || !eventId) return;
    setPlacing(true);
    setError('');
    try {
      const snapshot = cart.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity }));
      await createOrder({
        eventId,
        source: 'pos',
        items: snapshot.map((i) => ({ productId: i.id, quantity: i.quantity })),
        paymentMethod: 'balance',
        balanceId: balance?.id,
        balanceUsed: balance?.id ? balance.balance ?? 0 : 0,
      });
      setPlaced(snapshot);
      setCart([]);
      setBalance((prev) => (prev ? { ...prev, balance: Math.max((prev.balance ?? 0) - cartTotal, 0) } : prev));
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

      <div className="mx-auto w-full max-w-lg px-4 space-y-4">
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
              return (
                <div
                  key={product.id}
                  className={cn(
                    'flex items-center gap-4 rounded-2xl border p-4 transition-all',
                    qty > 0 ? 'bg-brand/5 border-brand/30' : 'bg-surface border-border',
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-zinc-100">{product.name}</h3>
                      <span className="text-sm font-bold text-brand">€{Number(product.price).toFixed(2)}</span>
                    </div>
                    {product.description && (
                      <p className="mt-0.5 text-sm text-zinc-400 line-clamp-2">{product.description}</p>
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
                      aria-label={`Adicionar ${product.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-black hover:bg-brand-hover transition-colors"
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
            <Button
              size="lg"
              fullWidth
              onClick={handlePlace}
              loading={placing}
              disabled={!eventId}
              className="mb-4 justify-between"
            >
              <span>{placing ? 'A lançar…' : `Lançar ${cartCount} artigos`}</span>
              <span className="text-lg font-bold">€{cartTotal.toFixed(2)}</span>
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
