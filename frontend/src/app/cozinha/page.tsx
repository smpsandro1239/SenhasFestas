'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/api';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeftIcon, ChefHatIcon, RefreshIcon } from '@/components/ui/icons';
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

const statusMeta: Record<string, { label: string; variant: BadgeVariant; ring: string }> = {
  received: { label: 'Recebido', variant: 'warning', ring: 'border-l-orange-400' },
  preparing: { label: 'A Preparar', variant: 'brand', ring: 'border-l-brand' },
  ready: { label: 'Pronto', variant: 'success', ring: 'border-l-emerald-400' },
  delivered: { label: 'Entregue', variant: 'info', ring: 'border-l-blue-400' },
  cancelled: { label: 'Cancelado', variant: 'danger', ring: 'border-l-red-400' },
};

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

export default function CozinhaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'received' | 'preparing'>('all');
  const now = useClock();

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

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await fetchWithAuth(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchOrders();
    } catch {
      setError('Erro ao atualizar estado do pedido');
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return ['received', 'preparing'].includes(order.status);
    return order.status === filter;
  });

  const count = (status: string) => orders.filter((o) => o.status === status).length;

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
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                    Cozinha / KDS
                  </h1>
                  <p className="text-xs text-zinc-500">Atualização automática a cada 3s</p>
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
              <div className="text-5xl mb-4">🫧</div>
              <h2 className="text-xl font-semibold text-zinc-400">Nenhum pedido na fila</h2>
              <p className="text-zinc-600 mt-2">Os pedidos aparecerão aqui assim que forem feitos</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-5">
              {filteredOrders.map((order, idx) => {
                const meta = statusMeta[order.status];
                const elapsed = elapsedSince(order.createdAt);

                return (
                  <article
                    key={order.id}
                    className={cn(
                      'rounded-2xl border border-border bg-surface-solid overflow-hidden animate-fade-in',
                      meta.ring,
                      order.status === 'ready' ? 'glow-green' : '',
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

                      {/* Elapsed */}
                      <div className="text-right shrink-0">
                        <div className="text-3xl font-bold font-mono text-brand tabular-nums">
                          {Math.floor(elapsed / 60)}m {String(elapsed % 60).padStart(2, '0')}s
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">em espera</div>
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
                        Total: <span className="text-brand">€{Number(order.total).toFixed(2)}</span>
                      </span>

                      <div className="flex gap-3">
                        {order.status === 'received' && (
                          <button
                            onClick={() => updateStatus(order.id, 'preparing')}
                            className="px-6 py-3.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold text-base hover:bg-orange-500/25 transition-colors"
                          >
                            ▶ Iniciar Preparação
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => updateStatus(order.id, 'ready')}
                            className="px-6 py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-base hover:bg-emerald-500/25 transition-colors"
                          >
                            ✅ Marcar Pronto
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