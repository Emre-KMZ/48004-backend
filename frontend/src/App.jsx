import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import BackendHealth from "./pages/BackendHealth";
import DBHealth from "./pages/DBHealth";
import ProtectedRoute from "./components/ProtectedRoute";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ProductGallery from "./pages/ProductGallery";
import ProductDetail from "./pages/ProductDetail";
import AdminDashboard from "./pages/AdminDashboard";
import Checkout from "./pages/Checkout";
import Basket from "./pages/Basket";
import OrderHistory from "./pages/OrderHistory";
import OrderDetail from "./pages/OrderDetail";
import { useState } from 'react';
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider, useCart } from "./context/CartContext";

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    body {
      background-color: #FFF5F8;
      font-family: 'Outfit', sans-serif;
      color: #333;
      margin: 0;
    }
  `}</style>
)

function Navbar({ onToggleSidebar }) {
  const { auth, logout } = useAuth();
  const { totalItems } = useCart();
  
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '1rem 2.5rem', color: '#333', boxShadow: '0 2px 15px rgba(233,30,99,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <button onClick={onToggleSidebar} style={{ background: 'none', border: 'none', fontSize: '1.8rem', color: '#E91E63', cursor: 'pointer', padding: 0 }}>
          ☰
        </button>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#E91E63', letterSpacing: '0.5px', fontWeight: '700' }}>MiniStore</h1>
        </Link>
        <div style={{ display: 'flex', gap: '1.5rem', fontWeight: '500' }}>
          <Link to="/backend-healthcheck" style={{ color: '#666', textDecoration: 'none', fontSize: '1.05rem' }}>SysHealth</Link>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontWeight: '500' }}>
        {auth.role === 'Admin' && (
          <Link to="/admin" style={{ color: '#D81B60', textDecoration: 'none', fontWeight: '700' }}>Admin Dashboard</Link>
        )}

        <Link to="/basket" style={{ color: '#333', textDecoration: 'none', fontWeight: '600' }}>
          My Basket{totalItems > 0 && (
            <span style={{ marginLeft: '6px', background: '#E91E63', color: 'white', borderRadius: '12px', padding: '1px 8px', fontSize: '0.8rem', fontWeight: '700' }}>{totalItems}</span>
          )}
        </Link>

        {auth.token ? (
           <>
              {(auth.role === 'Customer' || auth.role === 'Admin') && (
                <Link to="/orders" style={{ color: '#666', textDecoration: 'none' }}>Order History</Link>
              )}
              <span style={{ color: '#eee' }}>|</span>
              <span style={{ fontSize: '0.9rem', color: '#999' }}>{auth.email}</span>
              <button onClick={() => { logout(); window.location.href='/'; }} style={{ padding: '0.4rem 1.2rem', background: '#FFEBEE', color: '#D32F2F', border: 'none', cursor: 'pointer', borderRadius: '20px', fontWeight: '600' }}>Logout</button>
           </>
        ) : (
           <>
              <Link to="/login" style={{ color: '#666', textDecoration: 'none', fontWeight: '600' }}>Log In</Link>
              <Link to="/register" style={{ padding: '0.5rem 1.4rem', background: '#E91E63', color: 'white', textDecoration: 'none', borderRadius: '25px', fontWeight: '600', boxShadow: '0 4px 6px rgba(233,30,99,0.2)' }}>Register</Link>
           </>
        )}
      </div>
    </nav>
  );
}

function UnauthorizedPlaceholder() {
  return <div style={{textAlign: 'center', padding: '2rem'}}><h2>403 - Unauthorized</h2><p>You do not have permission to view this page.</p><Link to="/">Go Home</Link></div>;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthProvider>
      <CartProvider>
      <BrowserRouter>
        <GlobalStyle />
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main style={{ padding: "0 24px", margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <Routes>
            <Route path="/" element={<ProductGallery sidebarOpen={sidebarOpen} />} />
            
            {/* Public Routes */}
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/unauthorized" element={<UnauthorizedPlaceholder />} />
            <Route path="/backend-healthcheck" element={<BackendHealth />} />
            <Route path="/db-healthcheck" element={<DBHealth />} />

            {/* Public basket (guests have localStorage cart) */}
            <Route path="/basket" element={<Basket />} />

            {/* Protected Routes (Authenticated Customer & Admin) */}
            <Route element={<ProtectedRoute allowedRoles={['Customer', 'Admin']} />}>
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<OrderHistory />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
            </Route>

            {/* Protected Routes (Admin Only) */}
            <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>
            
          </Routes>
        </main>
      </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
