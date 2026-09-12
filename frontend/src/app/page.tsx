'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
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
  QrIcon,
  WalletIcon,
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

const clientShortcuts = [
  {
    href: '/qr-order',
    title: 'Menu da Festa',
    description: 'Ver menu e fazer pedidos',
    icon: QrIcon,
    color: 'bg-brand/10 text-brand border-brand/20',
  },
  {
    href: '/saldo',
    title: 'Saldo e Recargas',
    description: 'Ver saldo e histórico',
    icon: WalletIcon,
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
];

const STAFF_ROLES = ['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer'];

export default function HomePage() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    recebidos: 0,
    emPreparacao: 0,
    prontos: 0,
    total: 0,
  });
  const [error, setError] = useState('');

  const fetchEstatisticas = useCallback(async () => {
    try {
      const data = await fetchWithAuth<Estatisticas>('/reports/estatisticas');
      setEstatisticas(data);
      setError('');
    } catch {
      setError('Não foi possível obter as estatísticas.');
    }
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    fetchEstatisticas();
    const interval = setInterval(fetchEstatisticas, 5000);
    return () => clearInterval(interval);
  }, [isStaff, fetchEstatisticas]);

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
          title={isStaff ? 'Painel de Controlo' : 'Olá, bem-vindo'}
          subtitle={isStaff ? 'Visão geral dos pedidos em tempo real' : 'Escolha uma opção para começar'}
          icon={<CalendarIcon className="h-5 w-5" />}
        />

        {isStaff && error && (
          <div className="mb-6">
            <Alert variant="warning" message={error} />
          </div>
        )}

        {/* Stats grid (apenas staff) */}
        {isStaff && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((card, idx) => (
              <div key={card.label} className={`animate-fade-in stagger-${idx + 1}`}>
                <StatCard {...card} />
              </div>
            ))}
          </div>
        )}

        {/* Shortcuts — clientes veem Menu + Saldo; staff vê o painel operacional */}
        <div className="grid md:grid-cols-3 gap-4">
          {(isStaff ? shortcuts : clientShortcuts).map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`animate-fade-in stagger-${idx + 1}`}>
                <Card hover className="h-full">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl border ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {!isStaff && (
                      <div className="text-center">
                        <span className="text-xs text-brand font-medium">Começar</span>
                      </div>
                    )}
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
          {isStaff && (
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-zinc-500 hover:text-brand transition-colors">Admin</Link>
              <span className="text-zinc-700">•</span>
              <Link href="/relatorios" className="text-zinc-500 hover:text-brand transition-colors">Relatórios</Link>
              <span className="text-zinc-700">•</span>
              <Link href="/caixa" className="text-zinc-500 hover:text-brand transition-colors">Caixa</Link>
            </div>
          )}
        </footer>
      </AppShell>
    </>
  );
}