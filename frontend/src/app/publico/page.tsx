'use client';

import { useState, useEffect } from 'react';

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

export default function PublicoPage() {
  const [receivedOrders, setReceivedOrders] = useState<PublicOrder[]>([]);
  const [preparingOrders, setPreparingOrders] = useState<PublicOrder[]>([]);
  const [readyOrders, setReadyOrders] = useState<PublicOrder[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const [received, preparing, ready] = await Promise.all([
        fetch('/api/public/pedidos-recebidos').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/public/pedidos-em-preparacao').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/public/pedidos-prontos').then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      setReceivedOrders(received);
      setPreparingOrders(preparing);
      setReadyOrders(ready);
    } catch (err) {
      setError('Erro ao carregar');
    }
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const OrderCard = ({ order, showAnimation = false }: { order: PublicOrder; showAnimation?: boolean }) => (
    <div className={`${showAnimation ? 'animate-pulse' : ''} bg-slate-700 rounded-2xl p-8 text-center transform transition-all duration-500 hover:scale-105`}>
      <div className="text-5xl font-bold text-white mb-4">
        #{order.id.slice(-4)}
      </div>
      <div className="text-3xl font-bold text-amber-400">
        {getTimeAgo(order.createdAt)}
      </div>
      {order.tableNumber && (
        <div className="text-sm text-slate-400 mt-2">
          Mesa {order.tableNumber}
        </div>
      )}
    </div>
  );

  return (
    <>
      <title>Ecrã Público - SenhasFestas</title>

      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-6xl font-bold mb-2 text-amber-400">
              📺 Ecrã Público
            </h1>
            <p className="text-xl text-slate-300">
              Festa de Aldeia - 15 de Agosto de 2026
            </p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-yellow-400">
                  🟡 Recebido
                </h2>
                <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold">
                  {receivedOrders.length}
                </span>
              </div>
              <div className="space-y-4">
                {receivedOrders.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-lg">Sem pedidos</p>
                  </div>
                ) : (
                  receivedOrders.map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-orange-400">
                  🔥 A Preparar
                </h2>
                <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm font-bold">
                  {preparingOrders.length}
                </span>
              </div>
              <div className="space-y-4">
                {preparingOrders.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-lg">Sem pedidos</p>
                  </div>
                ) : (
                  preparingOrders.map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-green-400">
                  ✅ Prontos
                </h2>
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-bold">
                  {readyOrders.length}
                </span>
              </div>
              <div className="space-y-4">
                {readyOrders.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-lg">Sem pedidos</p>
                  </div>
                ) : (
                  readyOrders.map(order => (
                    <OrderCard key={order.id} order={order} showAnimation={true} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-slate-500 text-sm">
            <p>Atualização automática em tempo real</p>
            <p className="mt-2 text-slate-600">
              Total: {receivedOrders.length + preparingOrders.length + readyOrders.length} pedidos ativos
            </p>
          </div>
        </div>
      </main>
    </>
  );
}