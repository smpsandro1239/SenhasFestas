'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { MinusIcon, PlusIcon, QrIcon, CameraIcon, ArrowLeftIcon, CheckIcon } from '@/components/ui/icons';
import { QrScanner } from '@/components/ui/qr-scanner';
import { useAuth } from '@/lib/auth-context';
import { useCurrentEvent } from '@/lib/use-current-event';
import { getProducts, getBalance, createOrder, getProductSuggestions, getEventByCode } from '@/lib/api';
import { normalizarShortCode } from '@/lib/entrar';
import { parseQrMesa } from '@/lib/mesa-qr';
import { escolherEventoId, eventosDisponiveis } from '@/lib/eventos';
import type { Product, CartItem } from '@/lib/types';
import { groupProducts } from '@/lib/group-products';
import { getOrderTotal } from '@/lib/order-total';

export default function QROrderPageWrapper() {
  return (
    <Suspense fallback={null}>
      <QROrderPage />
    </Suspense>
  );
}

function QROrderPage() {
  const searchParams = useSearchParams();
  const { event, events, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [eventoManual, setEventoManual] = useState<string | null>(null);
  const [codigoEvento, setCodigoEvento] = useState<string | null>(null);
  const urlCode = searchParams.get('code') ?? '';

  useEffect(() => {
    const codigo = normalizarShortCode(urlCode);
    if (!codigo) {
      setCodigoEvento(null);
      return;
    }
    let ativo = true;
    getEventByCode(codigo)
      .then((ev) => {
        if (ativo) setCodigoEvento(ev?.id ?? null);
      })
      .catch(() => {
        if (ativo) setCodigoEvento(null);
      });
    return () => {
      ativo = false;
    };
  }, [urlCode]);

  const eventId = escolherEventoId(
    events,
    searchParams.get('event') ?? codigoEvento ?? eventoManual,
  ) ?? '';
  const initialTableNumber = searchParams.get('mesa') ?? searchParams.get('table') ?? '';
  const disponiveis = eventosDisponiveis(events);
  const eventoDisponivelEscolhido = disponiveis.some((e) => e.id === eventId);
  const preciseiEscolha = disponiveis.length > 1 && !eventId;
  const [tableNumber, setTableNumber] = useState(initialTableNumber);
  const [showTableModal, setShowTableModal] = useState(!initialTableNumber);
  const [tableDraft, setTableDraft] = useState('');
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [balance, setBalance] = useState<
    { id?: string; balance?: number; archivedAt?: string | null } | null
  >(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [lastOrder, setLastOrder] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [lastCartId, setLastCartId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState('');
  const router = useRouter();

  const tratarScan = useCallback(
    async (texto: string) => {
      setScanError('');
      setShowScanner(false);
      const qr = parseQrMesa(texto);
      if (!qr) {
        setScanError('QR não reconhecido. Usa o QR da tua mesa ou o do evento.');
        return;
      }
      try {
        const ev = await getEventByCode(normalizarShortCode(qr.shortCode));
        if (!ev) {
          setScanError('Evento não encontrado para este QR.');
          return;
        }
        setTableNumber(qr.numero ?? '');
        setShowTableModal(false);
        const mesa = qr.numero ? `&table=${encodeURIComponent(qr.numero)}` : '';
        router.replace(`/qr-order?event=${ev.id}${mesa}`);
      } catch {
        setScanError('Não foi possível identificar o evento deste QR.');
      }
    },
    [router],
  );

  const escolherEvento = useCallback(
    (id: string) => {
      if (!id) {
        setEventoManual(null);
        return;
      }
      setEventoManual(id);
      const mesa = tableNumber ? `&table=${encodeURIComponent(tableNumber)}` : '';
      router.replace(`/qr-order?event=${id}${mesa}`);
    },
    [router, tableNumber],
  );

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

  const groupedProducts = useMemo(() => groupProducts(products), [products]);

  useEffect(() => {
    if (!lastCartId || !eventId) return;
    let active = true;
    getProductSuggestions(lastCartId, eventId)
      .then((data) => {
        if (!active) return;
        setSuggestions(Array.isArray(data) ? data : data?.items ?? []);
      })
      .catch(() => {
        if (active) setSuggestions([]);
      });
    return () => {
      active = false;
    };
  }, [lastCartId, eventId]);

  useEffect(() => {
    if (cart.length > 0) {
      setLastCartId(cart[cart.length - 1].id);
    } else {
      setLastCartId(null);
      setSuggestions([]);
    }
  }, [cart]);

  useEffect(() => {
    if (!user) return;
    getBalance(user.id, eventId || undefined)
      .then((b) => setBalance(b ?? null))
      .catch(() => setBalance(null));
  }, [user, eventId]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existingItem = prev.find((item) => item.id === product.id);
      if (existingItem) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item && item.quantity > 1) {
        return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const getCartTotal = () => getOrderTotal(cart);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const usableBalance = Math.min(balance?.balance ?? 0, getCartTotal());
  const semSaldo =
    balance !== null && ((balance.balance ?? 0) <= 0 || Boolean(balance.archivedAt));

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setError('Adicione pelo menos um item ao carrinho');
      return;
    }
    if (!eventId) {
      setError('Evento não identificado no QR code');
      return;
    }
    const snapshot = [...cart];
    setPlacing(true);
    setError('');
    try {
      await createOrder({
        eventId,
        source: 'qr',
        tableNumber: tableNumber || undefined,
        paymentMethod: 'balance',
        balanceId: balance?.id,
        balanceUsed: balance?.id ? usableBalance : 0,
        items: snapshot.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      });
      setOrderPlaced(true);
      setLastOrder(snapshot);
      setCart([]);
      setShowPaymentModal(true);
      setBalance((prev) =>
        prev
          ? { ...prev, balance: Math.max((prev.balance ?? 0) - usableBalance, 0) }
          : prev,
      );
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar o pedido');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface-solid/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div className="flex-1 text-center">
              <h1 className="font-bold text-zinc-50 tracking-tight">Menu da Festa</h1>
              <p className="text-[11px] text-zinc-400">
                {tableNumber ? `Bem-vindo à mesa ${tableNumber}` : 'Bem-vindo à festa'}
              </p>
            </div>
            <div className="w-9" />
          </div>

          {/* Info bar */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setTableDraft(tableNumber);
                setShowTableModal(true);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border text-left hover:bg-surface-hover transition-colors"
            >
              <QrIcon className="h-4 w-4 text-brand" />
              <div className="flex-1">
                <div className="text-[10px] text-zinc-400">Mesa</div>
                <div className="text-sm font-semibold text-zinc-100">
                  {tableNumber || 'Sem mesa'}
                </div>
              </div>
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
              <span className="text-brand-light text-base leading-none">€</span>
              <div className="flex-1">
                <div className="text-[10px] text-zinc-400">Saldo</div>
                <div className="text-sm font-semibold text-emerald-400">
                  {(balance?.balance ?? 0).toFixed(2)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              aria-label="Escanear QR da mesa"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border hover:bg-surface-hover transition-colors"
            >
              <CameraIcon className="h-4 w-4 text-brand" />
              <div className="flex-1">
                <div className="text-[10px] text-zinc-400">Ler</div>
                <div className="text-sm font-semibold text-zinc-100">Scan</div>
              </div>
            </button>
          </div>

          {disponiveis.length > 1 && (
            <label className="mt-3 flex items-center gap-2">
              <span className="text-xs text-zinc-400 shrink-0">Evento</span>
              <select
                value={eventoDisponivelEscolhido ? eventId : ''}
                onChange={(e) => escolherEvento(e.target.value)}
                aria-label="Escolher evento"
                className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="">Em que evento estás?</option>
                {disponiveis.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name ?? e.id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      <QrScanner
        open={showScanner}
        onResult={tratarScan}
        onClose={() => setShowScanner(false)}
        title="Escaneia o QR da tua mesa"
      />

{/* Products */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-32">
        {scanError && (
          <div className="mb-4">
            <Alert variant="error" message={scanError} />
          </div>
        )}
        {event?.status === 'closed' ? (
          <div className="rounded-2xl border border-zinc-800 bg-surface p-8 text-center">
            <h2 className="text-2xl font-bold text-zinc-50 mb-2">Evento encerrado</h2>
            <p className="text-zinc-400 text-sm">
              Este evento já terminou e não aceita mais pedidos. Se tiver saldo por gastar,
              fale com o caixa para devolver o valor.
            </p>
          </div>
        ) : semSaldo ? (
          <div className="rounded-2xl border border-zinc-800 bg-surface p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold text-zinc-50">Sem saldo para pedir</h2>
            <Alert
              variant="info"
              message="Precisas de carregar saldo antes de pedir. Vai ao caixa."
            />
            <Button size="lg" className="w-full" onClick={() => router.push('/saldo')}>
              Ver saldo
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-zinc-100 mb-4">Escolha os seus petiscos</h2>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="shimmer h-24 rounded-2xl" />
                ))}
              </div>
            ) : !eventId && eventError ? (
              <Alert variant="error" message={eventError} />
            ) : preciseiEscolha ? (
              <Alert variant="info" message="Em que evento estás? Escolhe acima." />
            ) : !eventId ? (
              <Alert variant="info" message="Sem eventos activos de momento. Pede o QR do evento à organização." />
            ) : error ? (
              <Alert variant="error" message={error} />
            ) : products.length === 0 ? (
              <Alert variant="info" message="Nenhum produto disponível de momento." />
            ) : (
              <div className="space-y-6">
                {groupedProducts.map((group) => (
                  <section key={group.category?.id ?? 'sem-categoria'} aria-label={group.category?.name ?? 'Outros'}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                        {group.category?.name ?? 'Outros'}
                      </h3>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {group.items.map((product: Product) => {
                        const cartItem = cart.find((item) => item.id === product.id);
                        const qty = cartItem?.quantity || 0;
                        return (
                          <div
                            key={product.id}
                            className={cn(
                              'rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 border',
                              qty > 0
                                ? 'bg-brand/5 border-brand/30'
                                : 'bg-surface border-border',
                            )}
                          >
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-semibold text-zinc-100">{product.name}</h4>
                                <span className="text-sm font-bold text-brand-light">
                                  €{Number(product.price).toFixed(2)}
                                </span>
                              </div>
                              {product.description && (
                                <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">
                                  {product.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              {qty > 0 && (
                                <button
                                  onClick={() => removeFromCart(product.id)}
                                  className="h-8 w-8 rounded-lg bg-surface border border-border text-zinc-300 hover:bg-surface-hover flex items-center justify-center transition-colors"
                                >
                                  <MinusIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <span className={cn('text-sm font-semibold w-5 text-center', qty > 0 ? 'text-zinc-100' : 'text-transparent')}>
                                {qty}
                              </span>
                              <button
                                onClick={() => addToCart(product)}
                                className={cn(
                                  'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
                                  qty > 0
                                    ? 'bg-brand text-black hover:bg-brand-hover'
                                    : 'bg-surface border border-border text-zinc-300 hover:bg-surface-hover',
                                )}
                              >
                                <PlusIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Suggestions: people who ordered this also ordered */}
      {cart.length > 0 && suggestions.length > 0 && (
        <section
          aria-labelledby="sugestoes-title"
          className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 p-4"
        >
          <h3 id="sugestoes-title" className="text-sm font-bold text-zinc-100 mb-3">
            Quem pediu isto também pediu
          </h3>
          <ul className="space-y-2">
            {suggestions
              .filter((s: Product) => !cart.some((c: CartItem) => c.id === s.id))
              .map((s: Product) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="text-lg text-gray-200">€{Number(s.price ?? 0).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => addToCart(s)}
                    className="flex-1 text-left text-sm font-semibold text-zinc-100 hover:text-brand transition-colors"
                  >
                    {s.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => addToCart(s)}
                    aria-label={'Adicionar ' + s.name + ' ao pedido'}
                    className="btnAddSuggestions bg-brand hover:bg-brand-hover text-black font-bold h-8 w-8 rounded-full flex items-center justify-center"
                  >
                    +
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Cart bottom bar */}
      <div
        className={cn(
          'fixed bottom-0 inset-x-0 z-30 transition-transform duration-300',
          cartCount > 0 ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="max-w-lg mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={handlePlaceOrder}
            disabled={placing}
            className="w-full mb-1 bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl shadow-glow flex items-center justify-between px-6 transition-colors"
          >
            <span>{placing ? 'A enviar...' : `${cartCount} item${cartCount === 1 ? '' : 's'}`}</span>
            <span className="text-lg">€{getCartTotal().toFixed(2)}</span>
          </button>
        </div>
      </div>

      {/* Table modal */}
      {showTableModal && !semSaldo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mudar-mesa-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-md bg-surface-solid border border-border rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-brand/10 text-brand mb-4">
                  <QrIcon className="h-5 w-5" />
                </div>
                <h2 id="mudar-mesa-title" className="text-2xl font-bold text-zinc-50">
                  Mesa do pedido
                </h2>
                <p className="text-zinc-400 text-sm mt-1">
                  Muda a mesa ou pede sem mesa para levantar no bar.
                </p>
              </div>
            </div>

            <Input
              value={tableDraft}
              onChange={(e) => setTableDraft(e.target.value)}
              placeholder="Ex.: A05 ou 12"
              label="Número da mesa"
              autoFocus
            />

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => {
                  setTableNumber('');
                  setTableDraft('');
                  setShowTableModal(false);
                }}
              >
                Sem mesa
              </Button>
              <Button
                size="lg"
                className="flex-1"
                disabled={!tableDraft.trim()}
                onClick={() => {
                  setTableNumber(tableDraft.trim().toUpperCase());
                  setShowTableModal(false);
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPaymentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pedido-confirmado-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-md bg-surface-solid border border-border rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-400 mb-4">
                  <CheckIcon className="h-5 w-5" />
                </div>
                <h2 id="pedido-confirmado-title" className="text-2xl font-bold text-zinc-50">Pedido Confirmado</h2>
                <p className="text-zinc-400 text-sm mt-1">A sua encomenda foi enviada para a cozinha!</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                aria-label="Fechar diálogo"
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface"
              >
                <QrIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 mb-5">
              {(lastOrder.length ? lastOrder : cart).map((item: CartItem) => (
                <div key={item.id} className="flex justify-between text-sm text-zinc-300">
                  <span>
                    <span className="text-zinc-400">{item.quantity}x</span> {item.name}
                  </span>
                  <span className="font-medium">€{((Number(item.price) || 0) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-border">
              <span className="text-zinc-400 font-medium">Total</span>
              <span className="text-2xl font-bold text-brand">
                €{getOrderTotal(lastOrder.length ? lastOrder : cart).toFixed(2)}
              </span>
            </div>

            <Button
              size="lg"
              className="w-full mt-6"
              onClick={() => {
                setShowPaymentModal(false);
                setOrderPlaced(false);
                setLastOrder([]);
                router.push('/');
              }}
            >
              OK, obrigado!
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}