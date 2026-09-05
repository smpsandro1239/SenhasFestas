'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api';

interface Order {
  id: string;
  status: 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  items: any[];
  total: number;
  createdAt: string;
  tableNumber?: string;
  source: 'qr' | 'pos';
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await fetchWithAuth<Order[]>('/orders');
      setOrders(data);
    } catch (err) {
      setError('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await fetchWithAuth(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchOrders();
    } catch (err) {
      setError('Erro ao atualizar estado');
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['received', 'preparing', 'ready'].includes(order.status);
    return ['delivered', 'cancelled'].includes(order.status);
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-yellow-500';
      case 'preparing': return 'bg-orange-500';
      case 'ready': return 'bg-green-500';
      case 'delivered': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'received': return 'Recebido';
      case 'preparing': return 'A Preparar';
      case 'ready': return 'Pronto';
      case 'delivered': return 'Entregue';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <>
      <title>Pedidos - SenhasFestas</title>

      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-amber-400">
              📋 Gestão de Pedidos
            </h1>
            <button
              onClick={fetchOrders}
              className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg"
            >
              🔄 Atualizar
            </button>
          </div>

          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg ${filter === 'active' ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
              Ativos ({orders.filter(o => ['received', 'preparing', 'ready'].includes(o.status)).length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg ${filter === 'completed' ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
              Concluídos ({orders.filter(o => ['delivered', 'cancelled'].includes(o.status)).length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
              Todos ({orders.length})
            </button>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-400 border-t-transparent"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map(order => (
              <div key={order.id} className="bg-slate-800 rounded-xl p-4 border-l-4" style={{
                borderLeftColor: order.status === 'received' ? '#eab308' :
                                order.status === 'preparing' ? '#f97316' :
                                order.status === 'ready' ? '#22c55e' : '#64748b'
              }}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="font-bold text-lg">#{order.id.slice(-4)}</span>
                    {order.tableNumber && (
                      <span className="ml-2 text-slate-400">Mesa {order.tableNumber}</span>
                    )}
                  </div>
                  <span className={`${getStatusColor(order.status)} px-3 py-1 rounded-full text-xs font-bold`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="space-y-1 mb-4">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="text-sm text-slate-300">
                      {item.quantity}x {item.name || item.product?.name}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                  <span className="text-xl font-bold text-amber-400">
                    €{order.total.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(order.createdAt).toLocaleTimeString('pt-PT')}
                  </span>
                </div>

                <div className="flex gap-2 mt-3">
                  {order.status === 'received' && (
                    <button
                      onClick={() => updateStatus(order.id, 'preparing')}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 py-2 rounded-lg text-sm font-bold"
                    >
                      🔥 A Preparar
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => updateStatus(order.id, 'ready')}
                      className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded-lg text-sm font-bold"
                    >
                      ✅ Pronto
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button
                      onClick={() => updateStatus(order.id, 'delivered')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-bold"
                    >
                      📦 Entregar
                    </button>
                  )}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <button
                      onClick={() => updateStatus(order.id, 'cancelled')}
                      className="bg-red-600/50 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredOrders.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-400">
              <p className="text-xl">Nenhum pedido encontrado</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}