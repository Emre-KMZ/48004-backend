import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import api from '../api/axios';

const FALLBACK_IMAGE = 'https://placehold.co/60x60/eeeeee/999999?text=?';

export default function Checkout() {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      setError('Please enter a shipping address.');
      return;
    }
    if (!contactName.trim() || !contactEmail.trim()) {
      setError('Please enter contact name and email.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/checkout/', {
        shipping_address: address.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
      });
      clearCart();
      navigate('/orders');
    } catch (err) {
      if (err.response?.status === 409) {
        navigate('/basket', {
          state: { inventoryError: 'Inventory changed: Some items in your cart are no longer available.' },
        });
        return;
      }
      setError(err.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ marginTop: '3rem', padding: '3rem', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 15px rgba(233,30,99,0.06)', border: '1px solid #FCE4EC', textAlign: 'center', fontFamily: 'Outfit' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
        <h1 style={{ color: '#D81B60', fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>Your basket is empty</h1>
        <p style={{ color: '#888', marginBottom: '2rem' }}>Add items before proceeding to checkout.</p>
        <Link to="/" style={{ padding: '0.8rem 2rem', background: '#E91E63', color: 'white', borderRadius: '25px', textDecoration: 'none', fontWeight: '600', display: 'inline-block' }}>
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '2rem', fontFamily: 'Outfit', maxWidth: '860px', margin: '2rem auto 0' }}>
      <h1 style={{ color: '#D81B60', fontSize: '2rem', fontWeight: '700', marginBottom: '1.5rem' }}>Checkout</h1>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Order Summary */}
        <div style={{ flex: '1 1 340px', background: '#fff', border: '1px solid #FCE4EC', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(233,30,99,0.05)' }}>
          <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', color: '#333', fontWeight: '700' }}>Order Summary</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
            {items.map(item => (
              <div key={item.id ?? item.product_id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <img
                  src={item.image_url || FALLBACK_IMAGE}
                  alt={item.name}
                  style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #F8BBD0', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ fontSize: '0.82rem', color: '#888' }}>
                    {item.quantity} × ${parseFloat(item.price).toFixed(2)}
                  </div>
                </div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', flexShrink: 0 }}>
                  ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #FCE4EC', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', color: '#555' }}>Total</span>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: '#E91E63' }}>${totalPrice}</span>
          </div>
        </div>

        {/* Shipping & Place Order */}
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: '#fff', border: '1px solid #FCE4EC', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(233,30,99,0.05)' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', color: '#333', fontWeight: '700' }}>Shipping Address</h2>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Enter your full shipping address..."
              rows={5}
              style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #F8BBD0', outlineColor: '#E91E63', fontFamily: 'Outfit', resize: 'vertical', boxSizing: 'border-box', lineHeight: '1.5' }}
            />
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="Contact full name"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', borderRadius: '10px', border: '1px solid #F8BBD0', outlineColor: '#E91E63', fontFamily: 'Outfit', boxSizing: 'border-box' }}
              />
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="Contact email"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', borderRadius: '10px', border: '1px solid #F8BBD0', outlineColor: '#E91E63', fontFamily: 'Outfit', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="Contact phone (optional)"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', borderRadius: '10px', border: '1px solid #F8BBD0', outlineColor: '#E91E63', fontFamily: 'Outfit', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.85rem 1rem', background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '10px', color: '#C62828', fontSize: '0.9rem', fontWeight: '500' }}>
              {error}
            </div>
          )}

          <button
            onClick={handlePlaceOrder}
            disabled={submitting}
            style={{ width: '100%', padding: '1rem', background: submitting ? '#ccc' : '#E91E63', color: 'white', border: 'none', borderRadius: '25px', fontSize: '1.1rem', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 4px 12px rgba(233,30,99,0.25)', transition: 'all 0.2s', fontFamily: 'Outfit' }}>
            {submitting ? 'Placing Order...' : 'Place Order →'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <Link to="/basket" style={{ color: '#999', fontSize: '0.9rem', textDecoration: 'none' }}>
              ← Back to Basket
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
