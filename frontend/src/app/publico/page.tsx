'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';

interface PublicOrder {
  id: string;
  status: 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  items: any[];
  total: number;
  createdAt: string;
  updatedAt?: string;
  tableNumber?: string;
  source: 'qr' | 'pos';
}

interface PublicList {
  [key: string]: PublicOrder[];
}

const COLUMN_META = [
  {
    key: 'received',
    title: 'Recebidos',
    emoji: '📥',
    accent: 'text-orange-400',
    badgeBg: 'bg-orange-400',
    border: 'border-orange-400/20',
  },
  {
    key: 'preparing',
    title: 'A Preparar',
    emoji: '🔥',
    accent: 'text-brand',
    badgeBg: 'bg-brand',
    border: 'border-brand/20',
  },
  {
    key: 'ready',
    title: 'Prontos',
    emoji: '✅',
    accent: 'text-emerald-400',
    badgeBg: 'bg-emerald-400',
    border: 'border-emerald-400/20',
  },
];

const TICK = 2000;

export default function PublicoPage() {
  const [orders, setOrders] = useState<Record<string, PublicOrder[]>>({
    received: [],
    preparing: [],
    ready: [],
  });
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const [received, preparing, ready] = await Promise.all([
        fetch('/api/public/pedidos-recebidos')
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch('/api/public/pedidos-em-preparacao')
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch('/api/public/pedidos-prontos')
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);
      setOrders({ received, preparing, ready });
      setError('');
    } catch {
      setError('Erro ao carregar estados');
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, TICK);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const totalActive =
    orders.received.length + orders.preparing.length + orders.ready.length;

  return (
    <>
      <title>Ecrã Público - SenhasFestas</title>

      {/* TV-optimized: fixed full viewport, zero page scroll */}
      <main className="tv-layout fixed inset-0 overflow-hidden flex flex-col bg-zinc-950 text-zinc-100">
        {/* Header */}
        <header className="shrink-0 px-[5vw] py-[3vh] text-center">
          <h1 className="text-[clamp(2rem,5vw,4.5rem)] font-bold tracking-tight text-gradient">
            📺 SenhasFestas
          </h1>
          <p className="mt-[1vh] text-[clamp(1rem,2vw,1.75rem)] text-zinc-500">
            Festa de Aldeia • 15 de Agosto de 2026
          </p>
        </header>

        {error && (
          <div className="px-[5vw] text-center">
            <p className="inline-block px-6 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xl">
              {error}
            </p>
          </div>
        )}

        {/* Columns */}
        <div className="flex-1 min-h-0 px-[5vw] pb-[2vh]">
          <div className="h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2vw]">
            {COLUMN_META.map((meta) => {
              const columnOrders = orders[meta.key] || [];

              return (
                <section
                  key={meta.key}
                  className={cn(
                    'flex flex-col min-h-0 rounded-3xl border bg-surface-solid/50 backdrop-blur-sm overflow-hidden',
                    meta.border,
                  )}
                >
                  {/* Column header */}
                  <div className="shrink-0 flex items-center justify-between gap-4 px-[2vw] py-[2vh] border-b border-border">
                    <h2 className="flex items-center gap-4 text-[clamp(1.5rem,3.5vw,3rem)] font-bold">
                      <span>{meta.emoji}</span>
                      <span className={meta.accent}>{meta.title}</span>
                    </h2>
                    <span
                      className={cn(
                        'shrink-0 min-w-[3.5rem] text-center px-4 py-1 rounded-full text-[clamp(1.25rem,2.5vw,2rem)] font-bold text-zinc-950',
                        meta.badgeBg,
                      )}
                    >
                      {columnOrders.length}
                    </span>
                  </div>

                  {/* Cards list */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-[1.5vw] space-y-[1.5vh]">
                    {columnOrders.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-700">
                        <span className="text-[clamp(3rem,8vw,6rem)] leading-none mb-4">💤</span>
                        <p className="text-[clamp(1.25rem,2.5vw,2rem)]">Sem pedidos</p>
                      </div>
                    ) : (
                      columnOrders.map((order, idx) => {
                        const isNew = idx === 0;
                        return (
                          <article
                            key={order.id}
                            className={cn(
                              'rounded-3xl bg-surface-hover border border-border px-[2vw] py-[2vh]',
                              'animate-slide-up',
                              meta.key === 'ready' && isNew && 'glow-green',
                            )}
                          >
                            <div className="flex items-center justify-between gap-6">
                              <span className="font-mono font-bold text-[clamp(2.5rem,7vw,5.5rem)] leading-none text-zinc-50">
                                #{order.id.slice(-4)}
                              </span>
                              <div className="text-right shrink-0">
                                <div
                                  className={cn(
                                    'font-mono font-bold text-[clamp(1.5rem,4vw,3rem)] tabular-nums leading-none',
                                    meta.key === 'ready'
                                      ? 'text-emerald-400'
                                      : 'text-zinc-400',
                                  )}
                                >
                                  {getTimeAgo(order.createdAt)}
                                </div>
                                {order.tableNumber && (
                                  <div className="mt-2 text-[clamp(1rem,2vw,1.5rem)] text-zinc-500">
                                    Mesa {order.tableNumber}
                                  </div>
                                )}
                              </div>
                            </div>

                            {meta.key === 'ready' && isNew && (
                              <div className="mt-3 flex items-center gap-3 text-emerald-400 text-[clamp(1rem,2vw,1.5rem)] font-medium">
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                Boa refeição!
                              </div>
                            )}
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-border px-[5vw] py-[2vh] flex items-center justify-between text-[clamp(0.9rem,1.75vw,1.4rem)] text-zinc-600">
          <span className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Atualização automática em tempo real
          </span>
          <span>{totalActive} pedidos ativos</span>
        </footer>
      </main>
    </>
  );
}