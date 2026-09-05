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
  station?: string;
}

export default function CozinhaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'received' | 'preparing'>('all');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000); // More frequent for KDS
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth<Order[]>('/kitchen/pedidos');
      setOrders(data);
    } catch (err) {
      setError('Erro ao carregar pedidos da cozinha');
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
      // Force refresh after status update
      await fetchOrders();
    } catch (err) {
      setError('Erro ao atualizar estado do pedido');
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return ['received', 'preparing'].includes(order.status);
    return order.status === filter;
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
      <title>Cozinha/KDS - SenhasFestas</title>

      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-5xl font-bold mb-8 text-center text-green-400">
            👨‍🍳 Cozinha / KDS
          </h1>

          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-green-600' : 'bg-slate-700'}`}
            >
              Todos ({filteredOrders.length})
            </button>
            <button
              onClick={() => setFilter('received')}
              className={`px-4 py-2 rounded-lg ${filter === 'received' ? 'bg-green-600' : 'bg-slate-700'}`}
            >
              Recebido ({orders.filter(o => o.status === 'received').length})
            </button>
            <button
              onClick={() => setFilter('preparing')}
              className={`px-4 py-2 rounded-lg ${filter === 'preparing' ? 'bg-green-600' : 'bg-slate-700'}`}
            >
              A Preparar ({orders.filter(o => o.status === 'preparing').length})
            </button>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-400 border-t-transparent"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredOrders.map(order => (
                <div key={order.id} className="bg-slate-800 rounded-2xl p-6 shadow-lg border-l-4" style={{
                  borderLeftColor: order.status === 'received' ? '#eab308' : '#f97316'
                }}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-3xl font-bold mb-2">Pedido #{order.id.slice(-4)}</h2>
                      <div className="flex space-x-2">
                        {order.tableNumber && (
                          <span className="bg-slate-700 px-3 py-1 rounded text-sm">
                            Mesa {order.tableNumber}
                          </span>
                        )}
                        <span className={`${getStatusColor(order.status)} px-3 py-1 rounded-full text-xs font-bold`}>
                          {getStatusLabel(order.status)}
                        </span>
                        {order.source === 'qr' && (
                          <span className="bg-blue-600/20 px-3 py-1 rounded text-xs text-blue-400">
                            QR
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-slate-400 text-sm">
                      {new Date(order.createdAt).toLocaleTimeString('pt-PT')}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex-1">
                          <span className="font-medium text-white">{item.quantity}x</span>
                          <span className="ml-2 text-slate-300">{item.name || item.product?.name}</span>
                        </div>
                        <span className="text-right font-mono text-amber-400">
                          €{(item.price || 0 * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-700">
                    <div className="flex justify-between">
                      <span className="text-lg font-bold text-white">
                        Total: €{order.total.toFixed(2)}
                      </span>
                      <div className="flex space-x-2">
                        {order.status === 'received' && (
                          <button
                            onClick={() => updateStatus(order.id, 'preparing')}
                            className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                          >
                            ▶️ A Preparar
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => updateStatus(order.id, 'ready')}
                            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                          >
                            ✅ Pronto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredOrders.length === 0 && !loading && (
                <div className="col-span-full text-center py-16">
                  <div className="text-2xl text-slate-400 mb-4">
                    📭 Nenhum pedido na fila
                  </div>
                  <p className="text-slate-500">
                    Os pedidos aparecerão aqui assim que forem feitos
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}