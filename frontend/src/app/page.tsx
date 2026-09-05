'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import {
  ClipboardIcon,
  ChefHatIcon,
  TvIcon,
  CalendarIcon,
} from '@/components/ui/icons';

interface Estatisticas {
  recebidos: number;
  emPreparacao: number;
  prontos: number;
  total: number;
}

const shortcuts = [
  {
    href: '/pedidos',
    title: 'Pedidos',
    description: 'Criar e gerir pedidos',
    icon: ClipboardIcon,
    valueKey: 'total' as const,
    color: 'bg-brand/10 text-brand border-brand/20',
  },
  {
    href: '/cozinha',
    title: 'Cozinha / KDS',
    description: 'Preparação de pedidos',
    icon: ChefHatIcon,
    valueKey: 'emPreparacao' as const,
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
  {
    href: '/publico',
    title: 'Ecrã Público',
    description: 'Visualização para clientes',
    icon: TvIcon,
    valueKey: 'prontos' as const,
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
];

export default function HomePage() {
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    recebidos: 0,
    emPreparacao: 0,
    prontos: 0,
    total: 0,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEstatisticas();
    const interval = setInterval(fetchEstatisticas, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchEstatisticas = async () => {
    try {
      const data = await fetchWithAuth<Estatisticas>('/reports/estatisticas');
      setEstatisticas(data);
      setError('');
    } catch {
      setError('Não foi possível obter as estatísticas.');
    }
  };

  const statCards = [
    {
      label: 'Recebidos',
      value: estatisticas.recebidos,
      sub: 'aguardam preparação',
      color: 'brand' as const,
    },
    {
      label: 'A Preparar',
      value: estatisticas.emPreparacao,
      sub: 'na cozinha',
      color: 'orange' as const,
    },
    {
      label: 'Prontos',
      value: estatisticas.prontos,
      sub: 'para entrega',
      color: 'green' as const,
    },
    {
      label: 'Total Ativo',
      value: estatisticas.total,
      sub: 'pedidos em curso',
      color: 'blue' as const,
    },
  ];

  return (
    <>
      <title>SenhasFestas - Gestão de Pedidos</title>

      <AppShell>
        <PageHeader
          title="Painel de Controlo"
          subtitle="Visão geral dos pedidos em tempo real"
          icon={<CalendarIcon className="h-5 w-5" />}
        />

        {error && (
          <div className="mb-6">
            <Alert variant="warning" message={error} />
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card, idx) => (
            <div key={card.label} className={`animate-fade-in stagger-${idx + 1}`}>
              <StatCard {...card} />
            </div>
          ))}
        </div>

        {/* Shortcuts */}
        <div className="grid md:grid-cols-3 gap-4">
          {shortcuts.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`animate-fade-in stagger-${idx + 1}`}>
                <Card hover className="h-full">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl border ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold tracking-tight text-zinc-50">
                        {estatisticas[item.valueKey]}
                      </div>
                      <div className="text-xs text-zinc-500">em curso</div>
                    </div>
                  </div>
                  <h2 className="mt-4 font-semibold text-zinc-100">{item.title}</h2>
                  <p className="text-sm text-zinc-500">{item.description}</p>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Footer info */}
        <footer className="mt-12 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
          <span>SenhasFestas v1.1 — Gestão de Pedidos</span>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-zinc-500 hover:text-brand transition-colors">Admin</Link>
            <span className="text-zinc-700">•</span>
            <Link href="/relatorios" className="text-zinc-500 hover:text-brand transition-colors">Relatórios</Link>
            <span className="text-zinc-700">•</span>
            <Link href="/caixa" className="text-zinc-500 hover:text-brand transition-colors">Caixa</Link>
          </div>
        </footer>
      </AppShell>
    </>
  );
}