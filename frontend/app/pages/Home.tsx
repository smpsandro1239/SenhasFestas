import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';

// Mock data for demonstration
const mockOrders = [
  { id: '1', eventId: 'evt-001', status: 'ready', total: 150.00, createdAt: new Date('2026-01-15T10:00:00Z') },
  { id: '2', eventId: 'evt-002', status: 'preparing', total: 85.50, createdAt: new Date('2026-01-15T11:00:00Z') },
  { id: '3', eventId: 'evt-003', status: 'delivered', total: 200.00, createdAt: new Date('2026-01-16T14:00:00Z') },
];

function Home() {
  const [currentPage, setCurrentPage] = useState('orders');
  const router = useRouter();

  return (
    <div className="container">
      <h1>SenhasFestas - MVP</h1>
      <nav>
        <button onClick={() => setCurrentPage('orders')}>Pedidos</button>
        <button onClick={() => setCurrentPage('public')}>Ecrã Público</button>
        <button onClick={() => setCurrentPage('reports')}>Relatórios</button>
      </nav>
      {currentPage === 'orders' && (
        <div className="orders-list">
          {mockOrders.map(order => (
            <div key={order.id} className="order-card">
              <h3>{order.id}</h3>
              <span className={`status-${order.status}`}>{order.status}</span>
              <p>Valor: R$ {order.total.toFixed(2)}</p>
              <button onClick={() => router.push(`/orders/${order.id}/details`)}>Detalhes</button>
            </div>
          ))}
        </div>
      )}
      {currentPage === 'public' && (
        <div className="public-dashboard">
          <h2>Ecrã Público</h2>
          <div className="dashboard-stats">
            <p>Pedidos prontos: {mockOrders.filter(o => o.status === 'ready').length}</p>
            <p>Em preparação: {mockOrders.filter(o => o.status === 'preparing').length}</p>
            <p>Entregues: {mockOrders.filter(o => o.status === 'delivered').length}</p>
          </div>
        </div>
      )}
      {currentPage === 'reports' && (
        <div className="reports-section">
          <h2>Relatórios</h2>
          <button onClick={() => router.push('/reports/orders')}>Ordens</button>
          <button onClick={() => router.push('/reports/saldo')}>Saldo</button>
          <button onClick={() => router.push('/reports/top-products')}>Top Products</button>
        </div>
      )}
    </div>
  );
}

export default Home;