'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { useCurrentEvent } from '@/lib/use-current-event';
import { useOrderSocket } from '@/lib/use-order-socket';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardIcon, RefreshIcon, CloseIcon } from '@/components/ui/icons';

interface Order {
  id: string;
  status: 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  items: any[];
  total: number;
  createdAt: string;
  tableNumber?: string;
  source: 'qr' | 'pos';
}

const statusMeta: Record<string, { label: string; variant: BadgeVariant }> = {
  received: { label: 'Recebido', variant: 'warning' },
  preparing: { label: 'A Preparar', variant: 'brand' },
  ready: { label: 'Pronto', variant: 'success' },
  delivered: { label: 'Entregue', variant: 'info' },
  cancelled: { label: 'Cancelado', variant: 'danger' },
};

function MeusPedidosPageInner() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  const { event: eventoAtual } = useCurrentEvent();

  const fetchOrders = useCallback(async () => {
    try {
      const data = await fetchWithAuth<any>('/orders/mine');
      setOrders(data?.items ?? []);
      setError('');
    } catch {
      setError('Erro ao carregar os pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useOrderSocket(fetchOrders, eventoAtual?.id);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const cancelar = async (orderId: string) => {
    try {
      await fetchWithAuth(`/orders/${orderId}/cancel`, {
        method: 'POST',
      });
      await fetchOrders();
    } catch {
      setError('Erro ao cancelar o pedido');
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['received', 'preparing', 'ready'].includes(order.status);
    return ['delivered', 'cancelled'].includes(order.status);
  });

  const count = (status: string) => orders.filter((o) => o.status === status).length;

  const tabs = [
    { id: 'active', label: 'Ativos', count: count('received') + count('preparing') + count('ready') },
    { id: 'completed', label: 'Concluídos', count: count('delivered') + count('cancelled') },
    { id: 'all', label: 'Todos', count: orders.length },
  ];

  return (
    <>
      <title>Os Meus Pedidos - SenhasFestas</title>

      <AppShell>
        <PageHeader
          title="Os Meus Pedidos"
          subtitle="Acompanha o estado dos teus pedidos"
          icon={<ClipboardIcon className="h-5 w-5" />}
          actions={
            <Button variant="secondary" onClick={fetchOrders} icon={<RefreshIcon className="h-4 w-4" />}>
              Atualizar
            </Button>
          }
        />

        {error && <div className="mb-6"><Alert variant="error" message={error} /></div>}

        <Tabs items={tabs} activeTab={filter} onChange={(id) => setFilter(id as any)} className="mb-6" />

        {loading ? (
          <div className="py-16"><Spinner label="A carregar pedidos..." /></div>
        ) : filteredOrders.length === 0 ? (
          <Card className="mt-4">
            <EmptyState
              icon={<ClipboardIcon className="h-6 w-6" />}
              title="Nenhum pedido encontrado"
              description={
                filter === 'active'
                  ? 'Ainda não tens pedidos em curso.'
                  : 'Ainda não tens pedidos concluídos.'
              }
            />
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOrders.map((order, idx) => {
              const meta = statusMeta[order.status];
              const canCancel = !['delivered', 'cancelled'].includes(order.status);

              return (
                <div key={order.id} className={`animate-fade-in stagger-${(idx % 6) + 1}`}>
                  <Card hover className="h-full">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg text-zinc-50">
                          #{order.id.slice(-4)}
                        </span>
                        {order.tableNumber && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-surface text-zinc-400 border border-border">
                            Mesa {order.tableNumber}
                          </span>
                        )}
                      </div>
                      <Badge variant={meta.variant} dot>
                        {meta.label}
                      </Badge>
                    </div>

                    <div className="space-y-1 mb-4">
                      {order.items?.map((item: any, itemIdx: number) => (
                        <div key={itemIdx} className="text-sm text-zinc-400 flex justify-between gap-2">
                          <span className="truncate">
                            <span className="text-zinc-400 font-medium">{item.quantity}x</span>{' '}
                            {item.name || item.product?.name}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-xl font-bold text-brand tracking-tight">
                        €{Number(order.total ?? 0).toFixed(2)}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {new Date(order.createdAt).toLocaleTimeString('pt-PT')}
                      </span>
                    </div>

                    {canCancel && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => cancelar(order.id)}
                          variant="danger"
                          className="flex-1"
                          aria-label="Cancelar pedido"
                        >
                          <CloseIcon className="h-4 w-4" />
                          Cancelar pedido
                        </Button>
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </AppShell>
    </>
  );
}

export default function MeusPedidosPage() {
  return (
    <Suspense fallback={null}>
      <MeusPedidosPageInner />
    </Suspense>
  );
}