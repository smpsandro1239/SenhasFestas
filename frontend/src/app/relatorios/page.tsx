'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { ChartIcon } from '@/components/ui/icons';
import { getReports, getOrders } from '@/lib/api';
import { useCurrentEvent } from '@/lib/use-current-event';

interface Estatisticas {
  recebidos: number;
  emPreparacao: number;
  prontos: number;
  entregues: number;
  total: number;
}

export default function RelatoriosPageWrapper() {
  return (
    <Suspense fallback={null}>
      <RelatoriosPage />
    </Suspense>
  );
}

function RelatoriosPage() {
  const { event } = useCurrentEvent();
  const [activeTab, setActiveTab] = useState('estatisticas');
  const [topProducts, setTopProducts] = useState<{
    id: string;
    name: string;
    price: string;
    totalVendido: string;
  }[]>([]);
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tabs = [
    { id: 'vendas', label: 'Vendas' },
    { id: 'topProducts', label: 'Top Produtos' },
    { id: 'saldo', label: 'Saldo' },
    { id: 'estatisticas', label: 'Estatísticas' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, productsData, ordersData] = await Promise.all([
        getReports('estatisticas').catch(() => null),
        getReports(
          'top-products',
          event ? { eventId: event.id } : undefined,
        ).catch(() => null),
        getOrders().catch(() => null),
      ]);
      setStats(statsData ?? null);
      setTopProducts(
        Array.isArray(productsData)
          ? productsData
          : productsData?.items ?? [],
      );
      const orders = Array.isArray(ordersData) ? ordersData : ordersData?.items ?? [];
      setOrderTotal(orders.reduce((sum: number, o: { total?: number }) => sum + Number(o.total || 0), 0));
    } catch {
      setError('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  }, [event]);

  useEffect(() => {
    load();
  }, [load]);

  const formatEuro = (value: number) => `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const maxSold = Math.max(1, ...topProducts.map((p) => Number(p.totalVendido || 0)));

  return (
    <>
      <title>Relatórios - SenhasFestas</title>

      <AppShell>
        <PageHeader
          title="Relatórios Operacionais"
          subtitle="Análise de vendas e desempenho do evento"
          icon={<ChartIcon className="h-5 w-5" />}
        />

        <Tabs items={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {error && <div className="mb-4"><Alert variant="error" message={error} /></div>}

        {activeTab === 'vendas' && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Vendas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Faturação (lista atual)', value: formatEuro(orderTotal), color: 'brand' as const },
                { label: 'Pedidos recebidos', value: String(stats?.recebidos ?? 0), color: 'blue' as const },
                { label: 'Pedidos entregues hoje', value: String(stats?.entregues ?? 0), color: 'green' as const },
              ].map((card, idx) => (
                <div key={card.label} className={`animate-fade-in stagger-${idx + 1}`}>
                  <StatCard label={card.label} value={loading ? '…' : card.value} color={card.color} />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'topProducts' && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Produtos Mais Vendidos</h2>
            {topProducts.length === 0 ? (
              <div className="text-sm text-zinc-500 py-4">Sem dados disponíveis.</div>
            ) : (
              <div className="space-y-3 max-w-2xl">
                {topProducts.map((item, idx) => (
                  <Card key={item.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-zinc-100">
                        <span className="text-zinc-500 font-medium mr-2">{idx + 1}.</span>
                        {item.name}
                      </span>
                      <span className="text-brand font-medium text-sm">
                        {Number(item.totalVendido || 0)} un.
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-700"
                        style={{ width: `${(Number(item.totalVendido || 0) / maxSold) * 100}%` }}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'saldo' && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Saldo (movimentos)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Consumido (lista atual)', value: formatEuro(orderTotal), color: 'orange' as const },
                { label: 'Pedidos em preparação', value: String(stats?.emPreparacao ?? 0), color: 'brand' as const },
                { label: 'Pedidos prontos', value: String(stats?.prontos ?? 0), color: 'green' as const },
              ].map((card, idx) => (
                <div key={card.label} className={`animate-fade-in stagger-${idx + 1}`}>
                  <StatCard label={card.label} value={loading ? '…' : card.value} color={card.color} />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'estatisticas' && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Estatísticas Operacionais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <StatCard label="Recebidos" value={String(stats?.recebidos ?? 0)} color="brand" />
              <StatCard label="Em Preparação" value={String(stats?.emPreparacao ?? 0)} color="blue" />
              <StatCard label="Prontos" value={String(stats?.prontos ?? 0)} color="orange" />
              <StatCard label="Entregues hoje" value={String(stats?.entregues ?? 0)} color="green" />
            </div>
          </div>
        )}
      </AppShell>
    </>
  );
}