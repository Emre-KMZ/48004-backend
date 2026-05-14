import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const validateEmail = (email) => {
    // A standard format: text @ text . text (at least 2 characters for domain)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    // Minimum 6 characters, at least one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    return passwordRegex.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation: Empty fields
    if (!formData.full_name || !formData.email || !formData.password || !formData.confirm_password) {
      setError('All fields are required.');
      return;
    }

    // Client-side validation: Email regex
    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email');
      return;
    }

    // Client-side validation: Password Strength
    if (!validatePassword(formData.password)) {
      setError('Password must be at least 6 characters long and include: 1 uppercase letter, 1 lowercase letter, and 1 number.');
      return;
    }

    // Client-side validation: Passwords match
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    try {
      // Send secure payload without role or confirm_password
      const response = await api.post('/api/register/', {
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
      });

      if (response.status === 201) {
        setSuccess(true);
        
        // Auto-login the user immediately after successful registration
        try {
          const authRes = await api.post('/api/login/', {
            email: formData.email,
            password: formData.password,
          });
          if (authRes.status === 200) {
            login(authRes.data.token, authRes.data.role, authRes.data.email);
            
            // HYBRID CART SYNC INTERCEPTOR
            try {
                const localCartStr = localStorage.getItem('cart');
                if (localCartStr) {
                    const localCart = JSON.parse(localCartStr);
                    if (localCart.length > 0) {
                        await api.post('/api/cart/sync/', { items: localCart }, {
                            headers: { Authorization: `Bearer ${authRes.data.token}` }
                        });
                        localStorage.removeItem('cart');
                    }
                }
            } catch(syncErr) { console.error("Cart sync failed during register-auth", syncErr); }
            
            // Wait just a moment for the green 'Success' message effect, then dump to homepage
            setTimeout(() => { navigate('/'); }, 1000);
          }
        } catch (autoLoginErr) {
          // Fallback if auto-login fails (server fault)
          setTimeout(() => { navigate('/login'); }, 1000);
        }
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Something went wrong with the server. Please try again later.');
      }
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
      <h2 style={{ textAlign: 'center', marginTop: '2rem', color: '#D81B60', fontSize: '2.2rem', fontWeight: '700' }}>Create Account</h2>
      <form onSubmit={handleSubmit} style={formStyle} noValidate>
        {error && <div style={{ color: '#d32f2f', padding: '0.75rem', background: '#ffebee', borderRadius: '4px', border: '1px solid #ef9a9a' }}>{error}</div>}
        {success && <div style={{ color: '#2e7d32', padding: '0.75rem', background: '#e8f5e9', borderRadius: '4px', border: '1px solid #a5d6a7' }}>Success! Redirecting to login...</div>}
        
        <label style={labelStyle}>
          Full Name
          <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} style={inputStyle} placeholder="John Doe" />
        </label>
        
        <label style={labelStyle}>
          Email Address
          <input type="email" name="email" value={formData.email} onChange={handleChange} style={inputStyle} placeholder="john@example.com" />
        </label>
        
        <label style={labelStyle}>
          Password
          <input type="password" name="password" value={formData.password} onChange={handleChange} style={inputStyle} placeholder="••••••••" />
        </label>
        
        <label style={labelStyle}>
          Confirm Password
          <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange} style={inputStyle} placeholder="••••••••" />
        </label>
        
        <button type="submit" style={buttonStyle}>Register Now</button>
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.95rem', color: '#666' }}>
          Already have an account? <Link to="/login" style={{ color: '#E91E63', fontWeight: '700', textDecoration: 'none' }}>Log In here</Link>
        </div>
      </form>
    </div>
  );
}
