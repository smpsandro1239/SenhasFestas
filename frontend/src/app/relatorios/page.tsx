'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { ChartIcon } from '@/components/ui/icons';

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState('vendas');

  const tabs = [
    { id: 'vendas', label: 'Vendas' },
    { id: 'topProducts', label: 'Top Produtos' },
    { id: 'saldo', label: 'Saldo' },
    { id: 'estatisticas', label: 'Estatísticas' },
  ];

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

        {activeTab === 'vendas' && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Vendas por Período</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Hoje', value: '€1.250', color: 'brand' as const },
                { label: 'Esta Semana', value: '€8.420', color: 'blue' as const },
                { label: 'Este Mês', value: '€32.180', color: 'green' as const },
              ].map((card, idx) => (
                <div key={card.label} className={`animate-fade-in stagger-${idx + 1}`}>
                  <StatCard label={card.label} value={card.value} color={card.color} />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'topProducts' && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Produtos Mais Vendidos</h2>
            <div className="space-y-3 max-w-2xl">
              {[
                { name: 'Cerveja Artesanal', qty: '245 unidades', pct: 100 },
                { name: 'Bifana', qty: '189 unidades', pct: 77 },
                { name: 'Caldo Verde', qty: '156 unidades', pct: 64 },
              ].map((item, idx) => (
                <Card key={item.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-zinc-100">
                      <span className="text-zinc-500 font-medium mr-2">{idx + 1}.</span>
                      {item.name}
                    </span>
                    <span className="text-brand font-medium text-sm">{item.qty}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-700"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'saldo' && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Saldo Carregado vs Consumido</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Carregado', value: '€5.420', color: 'green' as const },
                { label: 'Consumido', value: '€4.180', color: 'orange' as const },
                { label: 'Saldo Atual', value: '€1.240', color: 'brand' as const },
              ].map((card, idx) => (
                <div key={card.label} className={`animate-fade-in stagger-${idx + 1}`}>
                  <StatCard label={card.label} value={card.value} color={card.color} />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'estatisticas' && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Estatísticas Operacionais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <StatCard label="Tempo Médio de Preparação" value="3:45 min" sub="desde a receção" color="brand" />
              <StatCard label="Pedidos / Hora" value="42" sub="pico às 22:00" color="blue" />
            </div>
          </div>
        )}
      </AppShell>
    </>
  );
}