import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const STATUS_STYLES = {
  pending:    { background: '#FFF8E1', color: '#F57F17' },
  processing: { background: '#E3F2FD', color: '#1565C0' },
  shipped:    { background: '#E8F5E9', color: '#2E7D32' },
  delivered:  { background: '#F3E5F5', color: '#6A1B9A' },
  cancelled:  { background: '#FFEBEE', color: '#C62828' },
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get('/api/orders/history/');
        setOrders(res.data.orders || []);
      } catch {
        setError('Failed to load order history.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div style={{ marginTop: '3rem', textAlign: 'center', fontFamily: 'Outfit', color: '#999' }}>
        Loading orders...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: '3rem', textAlign: 'center', fontFamily: 'Outfit', color: '#D32F2F' }}>
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div style={{ marginTop: '3rem', padding: '3rem', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 15px rgba(233,30,99,0.06)', border: '1px solid #FCE4EC', textAlign: 'center', fontFamily: 'Outfit' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📦</div>
        <h1 style={{ color: '#D81B60', fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>No orders yet</h1>
        <p style={{ color: '#888', marginBottom: '2rem' }}>Your completed orders will appear here.</p>
        <Link to="/" style={{ padding: '0.8rem 2rem', background: '#E91E63', color: 'white', borderRadius: '25px', textDecoration: 'none', fontWeight: '600', display: 'inline-block' }}>
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '2rem', fontFamily: 'Outfit', maxWidth: '860px', margin: '2rem auto 0' }}>
      <h1 style={{ color: '#D81B60', fontSize: '2rem', fontWeight: '700', marginBottom: '1.5rem' }}>
        Order History
        <span style={{ marginLeft: '12px', fontSize: '1rem', color: '#999', fontWeight: '400' }}>
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </span>
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {orders.map(order => {
          const statusStyle = STATUS_STYLES[order.status] || { background: '#F5F5F5', color: '#555' };
          return (
            <Link
              key={order.order_id}
              to={`/orders/${order.order_id}`}
              style={{
                background: '#fff',
                border: '1px solid #FCE4EC',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 2px 8px rgba(233,30,99,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                flexWrap: 'wrap',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: '0.2s ease'
              }}
            >
              <div style={{ flex: '0 0 auto' }}>
                <div style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#D81B60' }}>#{order.order_id}</div>
              </div>

              <div style={{ flex: '1 1 120px' }}>
                <div style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</div>
                <div style={{ fontWeight: '600', color: '#333', fontSize: '0.95rem' }}>{formatDate(order.created_at)}</div>
              </div>

              <div style={{ flex: '0 0 auto' }}>
                <span style={{ padding: '0.3rem 0.85rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700', textTransform: 'capitalize', ...statusStyle }}>
                  {order.status}
                </span>
              </div>

              <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#333' }}>${parseFloat(order.total_price).toFixed(2)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
