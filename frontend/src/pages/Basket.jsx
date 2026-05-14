import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import api from '../api/axios';
import { useEffect, useState } from 'react';

const FALLBACK_IMAGE = 'https://placehold.co/80x80/eeeeee/999999?text=?';

export default function Basket() {
  const { items, loading, updateItem, removeItem, totalItems, totalPrice, refreshCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [stockError, setStockError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  useEffect(() => {
    const incomingMessage = location.state?.inventoryError;
    if (incomingMessage) {
      setStockError(incomingMessage);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);


  const hasInvalidItems = items.some(item => item.is_out_of_stock || item.exceeds_stock);

  const handleProceedToCheckout = async () => {
    if (items.length === 0) return;
    setStockError('');
    setCheckingOut(true);
    try {
      const payload = {
        items: items.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
      };
      await api.post('/api/products/validate-stock/', payload);
      navigate('/checkout');
    } catch (err) {
      if (err.response?.status === 409) {
        setStockError('Inventory changed: Some items in your cart are no longer available.');
        try {
          await refreshCart();
        } catch {
          // keep existing state if refresh fails
        }
        return;
      }
      setStockError(err.response?.data?.error || 'Unable to validate stock right now. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div style={{ marginTop: '3rem', textAlign: 'center', fontFamily: 'Outfit', color: '#999' }}>
        Loading basket...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ marginTop: '3rem', padding: '3rem', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 15px rgba(233,30,99,0.06)', border: '1px solid #FCE4EC', textAlign: 'center', fontFamily: 'Outfit' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
        <h1 style={{ color: '#D81B60', fontSize: '2rem', marginBottom: '0.5rem', fontWeight: '700' }}>Your basket is empty</h1>
        <p style={{ color: '#888', marginBottom: '2rem' }}>Browse our catalog and add items to get started.</p>
        <Link to="/" style={{ padding: '0.8rem 2rem', background: '#E91E63', color: 'white', borderRadius: '25px', textDecoration: 'none', fontWeight: '600', display: 'inline-block' }}>
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '2rem', fontFamily: 'Outfit', maxWidth: '860px', margin: '2rem auto 0' }}>
      <h1 style={{ color: '#D81B60', fontSize: '2rem', fontWeight: '700', marginBottom: '1.5rem' }}>
        My Basket
        <span style={{ marginLeft: '12px', fontSize: '1rem', color: '#999', fontWeight: '400' }}>
          {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </span>
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {items.map(item => (
          <div
            key={item.id ?? item.product_id}
            style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#fff', border: '1px solid #FCE4EC', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(233,30,99,0.05)' }}>
            <img
              src={item.image_url || FALLBACK_IMAGE}
              alt={item.name}
              style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0, border: '1px solid #F8BBD0' }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', color: '#333', fontSize: '1.05rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name}
              </div>
              {(item.is_out_of_stock || item.exceeds_stock) && (
                <div style={{ color: '#C62828', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                  {item.is_out_of_stock ? 'Disabled: Out of stock' : `Only ${item.stock} left in stock`}
                </div>
              )}
              <div style={{ color: '#E91E63', fontWeight: '700', fontSize: '1.1rem' }}>
                ${parseFloat(item.price).toFixed(2)}
                <span style={{ color: '#aaa', fontWeight: '400', fontSize: '0.85rem', marginLeft: '4px' }}>/ unit</span>
              </div>
            </div>

            {/* Quantity stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => {
                  if (item.quantity > 1) updateItem(item, item.quantity - 1);
                }}
                disabled={item.quantity <= 1}
                style={{ width: '32px', height: '32px', border: '1px solid #F8BBD0', background: '#FFF5F8', color: '#D81B60', borderRadius: '8px', cursor: item.quantity > 1 ? 'pointer' : 'not-allowed', fontSize: '1.1rem', fontWeight: '700', opacity: item.quantity <= 1 ? 0.4 : 1 }}>
                −
              </button>
              <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: '700', fontSize: '1rem' }}>
                {item.quantity}
              </span>
              <button
                onClick={() => updateItem(item, item.quantity + 1)}
                disabled={item.is_out_of_stock || (typeof item.stock === 'number' && item.quantity >= item.stock)}
                style={{ width: '32px', height: '32px', border: '1px solid #F8BBD0', background: '#FFF5F8', color: '#D81B60', borderRadius: '8px', cursor: item.is_out_of_stock || (typeof item.stock === 'number' && item.quantity >= item.stock) ? 'not-allowed' : 'pointer', fontSize: '1.1rem', fontWeight: '700', opacity: item.is_out_of_stock || (typeof item.stock === 'number' && item.quantity >= item.stock) ? 0.4 : 1 }}>
                +
              </button>
            </div>

            {/* Line total */}
            <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: '700', fontSize: '1.1rem', color: '#333', flexShrink: 0 }}>
              ${(parseFloat(item.price) * item.quantity).toFixed(2)}
            </div>

            {/* Remove */}
            <button
              onClick={() => removeItem(item)}
              title="Remove item"
              style={{ width: '32px', height: '32px', border: 'none', background: '#FFEBEE', color: '#D32F2F', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', fontWeight: '700', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Summary & CTA */}
      <div style={{ background: '#fff', border: '1px solid #FCE4EC', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(233,30,99,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '1.1rem', color: '#555' }}>
            Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})
          </span>
          <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#E91E63' }}>
            ${totalPrice}
          </span>
        </div>
        {stockError && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600' }}>
            {stockError}
          </div>
        )}
        <button
          onClick={handleProceedToCheckout}
          disabled={checkingOut || hasInvalidItems}
          style={{ width: '100%', padding: '1rem', background: checkingOut || hasInvalidItems ? '#ccc' : '#E91E63', color: 'white', border: 'none', borderRadius: '25px', fontSize: '1.15rem', fontWeight: '700', cursor: checkingOut || hasInvalidItems ? 'not-allowed' : 'pointer', boxShadow: checkingOut || hasInvalidItems ? 'none' : '0 4px 12px rgba(233,30,99,0.25)', transition: 'background 0.2s', fontFamily: 'Outfit' }}>
          {checkingOut ? 'Checking Stock...' : 'Proceed to Payment →'}
        </button>
        {hasInvalidItems && (
          <p style={{ margin: '0.75rem 0 0', color: '#C62828', fontSize: '0.85rem', textAlign: 'center' }}>
            Update or remove unavailable items to continue.
          </p>
        )}
        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <Link to="/" style={{ color: '#999', fontSize: '0.9rem', textDecoration: 'none' }}>
            ← Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
