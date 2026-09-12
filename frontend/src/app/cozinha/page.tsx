'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/api';
import { useCurrentEvent } from '@/lib/use-current-event';
import { useOrderSocket } from '@/lib/use-order-socket';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeftIcon, ChefHatIcon, RefreshIcon, PlayIcon, CheckIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

interface Order {
  id: string;
  status: 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  items: any[];
  total: number;
  createdAt: string;
  updatedAt?: string;
  tableNumber?: string;
  source: 'qr' | 'pos';
  station?: string;
}

const statusMeta: Record<string, { label: string; variant: BadgeVariant; ring: string; tint: string }> = {
  received: { label: 'Recebido', variant: 'warning', ring: 'border-l-orange-400', tint: 'bg-orange-500/[0.04]' },
  preparing: { label: 'A Preparar', variant: 'brand', ring: 'border-l-brand', tint: 'bg-brand/[0.04]' },
  ready: { label: 'Pronto', variant: 'success', ring: 'border-l-emerald-400', tint: 'bg-emerald-500/[0.06]' },
  delivered: { label: 'Entregue', variant: 'info', ring: 'border-l-blue-400', tint: 'bg-blue-500/[0.03]' },
  cancelled: { label: 'Cancelado', variant: 'danger', ring: 'border-l-red-400', tint: 'bg-red-500/[0.03]' },
};

function urgencyMeta(elapsedSeconds: number) {
  if (elapsedSeconds >= 600) {
    return { label: 'Há mais de 10 min', color: 'text-red-400', chip: 'bg-red-500/10 border-red-500/25', glow: 'glow-red' };
  }
  if (elapsedSeconds >= 300) {
    return { label: 'Há mais de 5 min', color: 'text-orange-400', chip: 'bg-orange-500/10 border-orange-500/25', glow: 'glow-orange' };
  }
  return { label: 'em espera', color: 'text-emerald-400', chip: 'bg-emerald-500/[0.07] border-emerald-500/20', glow: '' };
}

const statusOrder: Record<string, number> = {
  received: 0,
  preparing: 1,
  ready: 2,
  delivered: 3,
  cancelled: 4,
};

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function elapsedSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
}

function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function CozinhaPageInner() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'received' | 'preparing'>('all');
  const now = useClock();

  const { event: eventoAtual } = useCurrentEvent();

  const fetchOrders = useCallback(async () => {
    try {
      const data = await fetchWithAuth<any>('/kitchen/pedidos');
      const list = data?.items ?? [];
      const sorted = [...list].sort(
        (a, b) => statusOrder[a.status] - statusOrder[b.status]
      );
      setOrders(sorted);
      setError('');
    } catch {
      setError('Erro ao carregar pedidos da cozinha');
    } finally {
      setLoading(false);
    }
  }, []);

  useOrderSocket(fetchOrders, eventoAtual?.id);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await fetchWithAuth(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchOrders();
    } catch {
      setError('Erro ao atualizar estado do pedido');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return ['received', 'preparing'].includes(order.status);
    return order.status === filter;
  });

  const count = (status: string) => orders.filter((o) => o.status === status).length;
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const tabs = [
    { id: 'all', label: 'Todos', count: count('received') + count('preparing') },
    { id: 'received', label: 'Recebido', count: count('received') },
    { id: 'preparing', label: 'A Preparar', count: count('preparing') },
  ];

  return (
    <>
      <title>Cozinha/KDS - SenhasFestas</title>

      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-surface-solid/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2.5 rounded-xl bg-surface border border-border text-zinc-400 hover:text-zinc-100 hover:bg-surface-hover transition-colors"
                aria-label="Voltar ao início"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand glow-amber">
                  <ChefHatIcon className="h-6 w-6" />
                </div>
<div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                    Cozinha / KDS
                  </h1>
                  <span
                    aria-live="polite"
                    className="px-2.5 py-1 rounded-full bg-brand/10 border border-brand/25 text-brand font-semibold text-xs tabular-nums"
                  >
                    {tabs[0].count} na fila
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">Atualização automática a cada 3s</p>
              </div>
              </div>
            </div>
            <button
              onClick={fetchOrders}
              className="p-2.5 rounded-xl bg-surface border border-border text-zinc-400 hover:text-zinc-100 hover:bg-surface-hover transition-colors"
              aria-label="Atualizar pedidos"
            >
              <RefreshIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          {error && <div className="mb-6"><Alert variant="error" message={error} /></div>}

          <Tabs items={tabs} activeTab={filter} onChange={(id) => setFilter(id as any)} className="mb-6" layout="pills" />

          {loading && orders.length === 0 ? (
            <div className="py-20"><Spinner size="lg" label="A carregar pedidos..." /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="p-5 rounded-2xl bg-surface border border-border text-zinc-600 mb-4">
                <ChefHatIcon className="h-12 w-12" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-400">Nenhum pedido na fila</h2>
              <p className="text-zinc-600 mt-2">Os pedidos aparecerão aqui assim que forem feitos</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredOrders.map((order, idx) => {
                const meta = statusMeta[order.status];
                const elapsed = elapsedSince(order.createdAt);
                const urg = urgencyMeta(elapsed);
                const entrada = `animate-fade-in ${idx % 3 === 0 ? 'stagger-1' : idx % 3 === 1 ? 'stagger-2' : 'stagger-3'}`;

                return (
                  <article
                    key={order.id}
                    className={cn(
                      'rounded-2xl border border-border bg-surface-solid overflow-hidden',
                      meta.ring,
                      meta.tint,
                      order.status === 'ready' ? 'glow-green' : '',
                      entrada,
                    )}
                    style={{ borderLeftWidth: 4 }}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-4 px-6 pt-5">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                            Pedido <span className="font-mono">#{order.id.slice(-4)}</span>
                          </h2>
                          <Badge variant={meta.variant} dot>{meta.label}</Badge>
                          {order.station && (
                            <Badge variant="info">{order.station}</Badge>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-sm text-zinc-500">
                          {order.tableNumber && <span>Mesa {order.tableNumber}</span>}
                          {order.source === 'qr' && <Badge variant="brand" size="sm">QR</Badge>}
                          <span>{formatTime(order.createdAt)}</span>
                        </div>
                      </div>

                      {/* Elapsed / urgency */}
                      <div className={cn('text-right shrink-0 rounded-xl border px-3 py-2.5', urg.chip)}>
                        <div className={cn('text-3xl font-bold font-mono tabular-nums', urg.color)}>
                          {Math.floor(elapsed / 60)}m {String(elapsed % 60).padStart(2, '0')}s
                        </div>
                        <div className={cn('text-xs mt-0.5', urg.color)}>{urg.label}</div>
                      </div>
                    </div>

                    {/* Items list */}
                    <div className="px-6 mt-4 space-y-2 max-h-[40vh] overflow-y-auto">
                      {order.items?.map((item: any, itemIdx: number) => (
                        <div
                          key={itemIdx}
                          className="flex items-center justify-between gap-4 p-3 rounded-xl bg-surface/70"
                        >
                          <span className="flex items-center gap-3">
                            <span className="font-bold text-lg text-brand">{item.quantity}x</span>
                            <span className="text-zinc-200 text-base">
                              {item.name || item.product?.name}
                            </span>
                          </span>
                          {item.notes && (
                            <span className="text-xs text-zinc-500 italic truncate max-w-[40%]">
                              “{item.notes}”
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Footer actions */}
                    <div className="px-6 py-5 mt-4 border-t border-border flex items-center justify-between gap-4">
                      <span className="text-lg font-bold text-zinc-50">
                        Total: <span className="text-brand">€{Number(order.total ?? 0).toFixed(2)}</span>
                      </span>

                      <div className="flex gap-3">
                        {order.status === 'received' && (
                          <button
                            onClick={() => updateStatus(order.id, 'preparing')}
                            disabled={updatingId !== null}
                            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold text-base hover:bg-orange-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <PlayIcon className="h-4 w-4" />
                            Iniciar Preparação
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => updateStatus(order.id, 'ready')}
                            disabled={updatingId !== null}
                            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-base hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <CheckIcon className="h-4 w-4" />
                            Marcar Pronto
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function CozinhaPage() {
  return (
    <Suspense fallback={null}>
      <CozinhaPageInner />
    </Suspense>
  );
}