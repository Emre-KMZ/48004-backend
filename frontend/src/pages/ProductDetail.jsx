import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import api from '../api/axios';

const BACKEND_URL = 'http://localhost:8000';
const FALLBACK_IMAGE = 'https://placehold.co/800x600/eeeeee/999999?text=No+Image+Available';

export default function ProductDetail() {
  const { id } = useParams();
  const { auth } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    const loadDetail = async () => {
      try {
        const res = await api.get(`/api/products/${id}/`);
        setProduct(res.data);
        setCurrentImgIdx(0);
      } catch (err) {
        setError('Failed to fetch product details.');
      }
    };
    loadDetail();
  }, [id]);

  const handleAddToBasket = async () => {
    if (!product || product.stock <= 0) return;
    try {
      await addItem(product, Math.min(qty, product.stock));
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1500);
    } catch (err) {
      setError(err.message || 'Unable to add product to basket.');
    }
  };

  if (error) return <div style={{ padding: '2rem', color: 'red', textAlign: 'center', fontFamily: 'Outfit' }}>{error} - <Link to="/">Go Back</Link></div>;
  if (!product) return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Outfit' }}>Loading Details...</div>;

  const hasImages = product && product.images && product.images.length > 0;
  const currentImg = hasImages ? `${BACKEND_URL}${product.images[currentImgIdx].url}` : FALLBACK_IMAGE;

  const handlePrev = () => { if (currentImgIdx > 0) setCurrentImgIdx(currentImgIdx - 1); };
  const handleNext = () => { if (hasImages && currentImgIdx < product.images.length - 1) setCurrentImgIdx(currentImgIdx + 1); };

  return (
    <div style={{ background: '#fff', padding: '3rem', borderRadius: '16px', marginTop: '2rem', boxShadow: '0 4px 15px rgba(233,30,99,0.06)', border: '1px solid #FCE4EC' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: '1.5rem', textDecoration: 'none', color: '#D81B60', fontWeight: '600', fontFamily: 'Outfit' }}>← Back to Gallery</Link>

      <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
        {/* Gallery Stack */}
        <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <style>{`
            .nav-btn-left, .nav-btn-right {
              position: absolute;
              top: 0; bottom: 0;
              width: 15%;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              color: transparent;
              font-size: 3rem;
              transition: all 0.3s;
            }
            .nav-btn-left { left: 0; border-radius: 12px 0 0 12px; }
            .nav-btn-right { right: 0; border-radius: 0 12px 12px 0; }
            .nav-btn-left:hover { background: linear-gradient(to right, rgba(0,0,0,0.3), transparent); color: white; }
            .nav-btn-right:hover { background: linear-gradient(to left, rgba(0,0,0,0.3), transparent); color: white; }
          `}</style>

          <div style={{ position: 'relative', width: '100%', height: '450px', userSelect: 'none' }}>
            <img src={currentImg} alt="Main" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px', border: '1px solid #FCE4EC', backgroundColor: '#fff', padding: '1rem', boxSizing: 'border-box' }} />
            {hasImages && currentImgIdx > 0 && (
              <div key="prev-btn" className="nav-btn-left" onClick={handlePrev}>‹</div>
            )}
            {hasImages && currentImgIdx < product.images.length - 1 && (
              <div key="next-btn" className="nav-btn-right" onClick={handleNext}>›</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {product.images && product.images.map((img, idx) => (
              <img
                key={img.id}
                src={`${BACKEND_URL}${img.url}`}
                onClick={() => setCurrentImgIdx(idx)}
                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: currentImgIdx === idx ? '2px solid #E91E63' : '1px solid #F8BBD0', transition: 'all 0.2s', boxShadow: currentImgIdx === idx ? '0 2px 5px rgba(233,30,99,0.2)' : 'none' }}
                alt="Sub"
              />
            ))}
          </div>
        </div>

        {/* Info Stack */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', fontFamily: 'Outfit' }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0', color: '#333' }}>{product.name}</h1>
          {product.category_name && (
            <span style={{ padding: '0.3rem 0.8rem', background: '#F8BBD0', color: '#D81B60', borderRadius: '16px', fontSize: '0.85rem', width: 'fit-content', marginBottom: '1.5rem', fontWeight: '600' }}>
              {product.category_name}
            </span>
          )}

          <div style={{ fontSize: '2.5rem', color: '#E91E63', fontWeight: '700', marginBottom: '1.5rem' }}>${product.price}</div>

          <p style={{ lineHeight: '1.6', color: '#666', marginBottom: '2rem', fontSize: '1.05rem' }}>{product.description}</p>

          <div style={{ padding: '1.2rem', background: '#FFF5F8', borderRadius: '12px', border: '1px solid #FCE4EC', marginBottom: '2rem' }}>
            <strong style={{ color: '#D81B60' }}>Stock: </strong>
            <span style={{ color: product.stock > 0 ? '#333' : '#D32F2F', fontWeight: '600' }}>
              {product.stock > 0 ? `${product.stock} Units left` : 'Out of Stock'}
            </span>
          </div>

          {product.stock > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <span style={{ color: '#666', fontWeight: '500' }}>Quantity:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{ width: '36px', height: '36px', border: '1px solid #F8BBD0', background: '#FFF5F8', color: '#D81B60', borderRadius: '8px', cursor: 'pointer', fontSize: '1.2rem', fontWeight: '700' }}>
                  −
                </button>
                <span style={{ minWidth: '36px', textAlign: 'center', fontSize: '1.1rem', fontWeight: '600' }}>{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  disabled={qty >= product.stock}
                  style={{ width: '36px', height: '36px', border: '1px solid #F8BBD0', background: '#FFF5F8', color: '#D81B60', borderRadius: '8px', cursor: qty >= product.stock ? 'not-allowed' : 'pointer', opacity: qty >= product.stock ? 0.4 : 1, fontSize: '1.2rem', fontWeight: '700' }}>
                  +
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
            <button
              onClick={handleAddToBasket}
              disabled={product.stock <= 0}
              style={{ flex: 1, padding: '1rem', fontSize: '1.1rem', background: justAdded ? '#4CAF50' : (product.stock > 0 ? '#F8BBD0' : '#ccc'), color: justAdded ? 'white' : (product.stock > 0 ? '#D81B60' : 'white'), fontWeight: '700', border: 'none', borderRadius: '25px', cursor: product.stock > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
              {justAdded ? '✓ Added to Basket!' : (product.stock > 0 ? '+ Add to Basket' : 'Unavailable')}
            </button>
            <button
              disabled={product.stock <= 0}
              style={{ flex: 1, padding: '1rem', fontSize: '1.1rem', background: product.stock > 0 ? '#E91E63' : '#ccc', color: 'white', fontWeight: '700', border: 'none', borderRadius: '25px', cursor: 'not-allowed', transition: 'all 0.2s', boxShadow: product.stock > 0 ? '0 4px 10px rgba(233,30,99,0.2)' : 'none', opacity: 0.5 }}>
              Order Now ➔
            </button>
          </div>
          {product.stock > 0 && (
            <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: '#aaa', textAlign: 'center' }}>
              Direct order coming soon
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
