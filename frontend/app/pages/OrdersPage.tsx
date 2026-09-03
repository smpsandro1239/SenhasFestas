import { useState, useEffect } from 'react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, [selectedStatus]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const endpoint = selectedStatus === 'all' ? '/api/orders' : `/api/orders?status=${selectedStatus}`;
      const response = await fetch(endpoint);
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) return <div className="loading">Carregando pedidos...</div>;

  return (
    <div className="orders-page">
      <h1>Pedidos</h1>
      <div className="status-filter">
        <button onClick={() => setSelectedStatus('all')}>Todos</button>
        <button onClick={() => setSelectedStatus('received')}>Recebidos</button>
        <button onClick={() => setSelectedStatus('preparing')}>A Preparar</button>
        <button onClick={() => setSelectedStatus('ready')}>Prontos</button>
      </div>
      <div className="orders-list">
        {orders.map(order => (
          <div key={order.id} className={`order-card ${order.status}`}>
            <div className="order-header">
              <span className="order-id">{order.id}</span>
              <span className={`status-badge ${order.status}`}>
                {order.status}
              </span>
            </div>
            <div className="order-total">R$ {order.total.toFixed(2)}</div>
            <div className="order-actions">
              {order.status === 'received' && (
                <button onClick={() => updateStatus(order.id, 'preparing')}>A Preparar</button>
              )}
              {order.status === 'preparing' && (
                <button onClick={() => updateStatus(order.id, 'ready')}>Pronto</button>
              )}
              {order.status === 'ready' && (
                <button onClick={() => updateStatus(order.id, 'delivered')}>Entregue</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
