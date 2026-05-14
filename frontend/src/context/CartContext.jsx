import { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/axios';

const CartContext = createContext();
const GUEST_CART_KEY = 'guest_cart';
const BACKEND_URL = 'http://localhost:8000';

export const CartProvider = ({ children }) => {
  const { auth } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.token) {
      loadAuthCart();
    } else {
      const stored = localStorage.getItem(GUEST_CART_KEY);
      setItems(stored ? JSON.parse(stored) : []);
    }
  }, [auth.token]);

  const loadAuthCart = async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(GUEST_CART_KEY);
      if (stored) {
        const guestItems = JSON.parse(stored);
        if (guestItems.length > 0) {
          try {
            await api.post('/api/cart/sync/', { items: guestItems });
          } finally {
            localStorage.removeItem(GUEST_CART_KEY);
          }
        } else {
          localStorage.removeItem(GUEST_CART_KEY);
        }
      }
      const res = await api.get('/api/cart/');
      setItems(res.data.items || []);
    } catch {
      // cart fetch failed silently
    } finally {
      setLoading(false);
    }
  };

  const refreshCart = async () => {
    if (!auth.token) {
      const stored = localStorage.getItem(GUEST_CART_KEY);
      setItems(stored ? JSON.parse(stored) : []);
      return;
    }

    const res = await api.get('/api/cart/');
    setItems(res.data.items || []);
  };

  const persistGuest = (newItems) => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(newItems));
  };

  const getProductStock = async (productId) => {
    const res = await api.get(`/api/products/${productId}/stock/`);
    return {
      stock: Number(res.data.stock_quantity || 0),
      isAvailable: Boolean(res.data.is_available),
    };
  };

  const addItem = async (product, quantity) => {
    if (auth.token) {
      await api.post('/api/cart/', { product_id: product.id, quantity });
      await refreshCart();
    } else {
      const { stock } = await getProductStock(product.id);
      if (stock <= 0) {
        throw new Error('This product is currently out of stock.');
      }

      const updated = [...items];
      const idx = updated.findIndex(i => i.product_id === product.id);
      if (idx >= 0) {
        const requestedTotal = updated[idx].quantity + quantity;
        updated[idx] = {
          ...updated[idx],
          quantity: Math.min(requestedTotal, stock),
          stock,
          is_available: stock > 0,
          is_out_of_stock: stock <= 0,
          exceeds_stock: requestedTotal > stock,
        };
      } else {
        const adjustedQty = Math.min(quantity, stock);
        updated.push({
          id: null,
          product_id: product.id,
          name: product.name,
          price: String(product.price),
          quantity: adjustedQty,
          stock,
          is_available: stock > 0,
          is_out_of_stock: stock <= 0,
          exceeds_stock: quantity > stock,
          image_url: product.images?.length > 0 ? `${BACKEND_URL}${product.images[0].url}` : null,
        });
      }
      setItems(updated);
      persistGuest(updated);
    }
  };

  const updateItem = async (item, quantity) => {
    if (auth.token) {
      await api.put(`/api/cart/${item.id}/`, { quantity });
      await refreshCart();
    } else {
      const { stock } = await getProductStock(item.product_id);
      const adjustedQty = Math.max(1, Math.min(quantity, stock || 1));
      const updated = items.map(i =>
        i.product_id === item.product_id
          ? {
              ...i,
              quantity: adjustedQty,
              stock,
              is_available: stock > 0,
              is_out_of_stock: stock <= 0,
              exceeds_stock: quantity > stock,
            }
          : i
      );
      setItems(updated);
      persistGuest(updated);
    }
  };

  const removeItem = async (item) => {
    if (auth.token) {
      await api.delete(`/api/cart/${item.id}/`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } else {
      const updated = items.filter(i => i.product_id !== item.product_id);
      setItems(updated);
      persistGuest(updated);
    }
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(GUEST_CART_KEY);
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0).toFixed(2);

  return (
    <CartContext.Provider value={{ items, loading, addItem, updateItem, removeItem, clearCart, totalItems, totalPrice, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
