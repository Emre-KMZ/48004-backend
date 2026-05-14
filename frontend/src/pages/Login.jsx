import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      const response = await api.post('/api/login/', { email, password });
      if (response.status === 200) {
        // Hydrate the Global Auth State and local storage via the context
        login(response.data.token, response.data.role, response.data.email);
        
        // HYBRID CART SYNC INTERCEPTOR
        try {
            const localCartStr = localStorage.getItem('cart');
            if (localCartStr) {
                const localCart = JSON.parse(localCartStr);
                if (localCart.length > 0) {
                    await api.post('/api/cart/sync/', { items: localCart }, {
                        headers: { Authorization: `Bearer ${response.data.token}` }
                    });
                    localStorage.removeItem('cart');
                }
            }
        } catch(syncErr) { console.error("Cart sync failed during login", syncErr); }
        
        // Explicitly route to home page directly on success
        navigate('/');
      }
    } catch (err) {
      // Constraint 1: Generic failure response natively catches ANY error condition from /api/login/
      setError('Invalid email or password');
    }
  };

  const formStyle = {
    display: 'flex', flexDirection: 'column', gap: '1rem', 
    maxWidth: '400px', margin: '2rem auto', padding: '2.5rem', 
    border: '1px solid #FCE4EC', borderRadius: '16px', background: '#fff',
    boxShadow: '0 8px 30px rgba(233,30,99,0.08)'
  };
  const labelStyle = { display: 'flex', flexDirection: 'column', gap: '0.4em', fontWeight: '600', color: '#555', fontSize: '0.95rem' };
  const inputStyle = { padding: '0.8rem', borderRadius: '12px', border: '1px solid #F8BBD0', fontSize: '1rem', fontFamily: 'Outfit', outlineColor: '#E91E63' };
  const buttonStyle = { padding: '0.8rem', background: '#E91E63', color: 'white', border: 'none', borderRadius: '25px', cursor: 'pointer', fontSize: '1.2rem', fontWeight: '600', marginTop: '1rem', fontFamily: 'Outfit', transition: 'background 0.2s', boxShadow: '0 4px 10px rgba(233,30,99,0.2)' };

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginTop: '2rem', color: '#D81B60', fontSize: '2.2rem', fontWeight: '700' }}>Log In</h2>
      <form onSubmit={handleSubmit} style={formStyle} noValidate>
        {error && <div style={{ color: '#d32f2f', padding: '0.75rem', background: '#ffebee', borderRadius: '4px', border: '1px solid #ef9a9a' }}>{error}</div>}
        
        <label style={labelStyle}>
          Email Address
          <input type="email" value={email} onChange={e => {setEmail(e.target.value); setError('');}} style={inputStyle} placeholder="john@example.com" />
        </label>
        
        <label style={labelStyle}>
          Password
          <input type="password" value={password} onChange={e => {setPassword(e.target.value); setError('');}} style={inputStyle} placeholder="••••••••" />
        </label>
        
        <button type="submit" style={buttonStyle}>Login to Account</button>
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.95rem', color: '#666' }}>
          Don't have an account? <Link to="/register" style={{ color: '#E91E63', fontWeight: '700', textDecoration: 'none' }}>Register here</Link>
        </div>
      </form>
    </div>
  );
}
