import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { DollarSign, ShoppingCart, Users } from "lucide-react";

const BACKEND_URL = 'http://localhost:8000';
const FALLBACK = 'https://placehold.co/150x150?text=No+Img';

export default function AdminDashboard() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals & Forms
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  
  // Product Form State
  const [prodForm, setProdForm] = useState({ name: '', description: '', keywords: '', price: '', stock: '', category_id: '' });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [draggedEditIdx, setDraggedEditIdx] = useState(null);

  // Category Form State
  const [catName, setCatName] = useState('');

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (auth.role !== 'Admin') {
      navigate('/');
    } else {
      fetchData();
    }
  }, [auth]);

  const fetchData = async () => {
    try {
    setStatsLoading(true);

      const catRes = await api.get('/api/categories/');
      setCategories(catRes.data.categories);

      const prodRes = await api.get('/api/products/'); // The public endpoint returns everything we need for the table
      setProducts(prodRes.data.products);

      const statsRes = await api.get('/api/admin/stats/summary/');
      setStats(statsRes.data);

    } catch(e) { 
      console.error("Error fetching admin data", e); 
    } finally {
      setStatsLoading(false);
    }
  }

  // --- CATEGORY LOGIC ---
  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/categories/', { name: catName });
      setCatName('');
      fetchData();
    } catch(e) { alert("Failed to add category"); }
  }
  
  const handleDeleteCategory = async (id) => {
    if(!window.confirm("Delete category? This might drop assigned products!")) return;
    try {
      await api.delete(`/api/admin/categories/${id}/`);
      fetchData();
    } catch(e) { alert("Failed to delete category"); }
  }

  // --- PRODUCT LOGIC ---
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', prodForm.name);
    formData.append('description', prodForm.description);
    formData.append('keywords', prodForm.keywords);
    formData.append('price', prodForm.price);
    formData.append('stock', prodForm.stock);
    formData.append('category_id', prodForm.category_id);
    
    // In creation mode, append all selected files dynamically in exact array order
    if (!editProduct) {
        for (let i = 0; i < selectedFiles.length; i++) {
            formData.append('images', selectedFiles[i].file);
        }
    }

    try {
      if (editProduct) {
        // Update text parameters
        await api.put(`/api/admin/products/${editProduct.id}/`, prodForm);
      } else {
        // Create brand new product with images
        await api.post('/api/admin/products/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      closeProductModal();
      fetchData();
    } catch(e) { alert(e.response?.data?.error || "Error saving product. Check constraints."); }
  }

  const handleDeleteProduct = async (id) => {
    if(!window.confirm("Completely delete this product and auto-purge all its images from the server disk?")) return;
    try {
      await api.delete(`/api/admin/products/${id}/`);
      fetchData();
    } catch(e) { alert("Failed to delete"); }
  }

  const openEditModal = (p) => {
    setEditProduct(p);
    setProdForm({
      name: p.name, description: p.description, keywords: p.keywords,
      price: p.price, stock: p.stock, category_id: p.category_id || ''
    });
    setShowProductModal(true);
  }

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditProduct(null);
    setProdForm({ name: '', description: '', keywords: '', price: '', stock: '', category_id: '' });
    setSelectedFiles([]);
  }

  // --- GALLERY UPDATING LOGIC ---
  const handleSpecificImageAppend = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      await api.post(`/api/admin/products/${editProduct.id}/images/`, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      fetchData();
      
      // Auto-update modal preview
      const updated = await api.get(`/api/admin/products/${editProduct.id}/`);
      setEditProduct(updated.data);
    } catch(err) { alert(err.response?.data?.error || "Error appending file"); }
  }

  const handleSpecificImageDelete = async (img_id) => {
    if(!window.confirm("Permanently delete this specific image from disk?")) return;
    try {
      await api.delete(`/api/admin/product-images/${img_id}/`);
      fetchData();
      const updated = await api.get(`/api/admin/products/${editProduct.id}/`);
      setEditProduct(updated.data);
    } catch(err) { alert("Failed to trash image."); }
  }

  // --- DRAG AND DROP METHODS ---
  const handleFileSelect = (e) => {
    const rawFiles = Array.from(e.target.files);
    const newFiles = rawFiles.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      preview: URL.createObjectURL(f)
    }));
    setSelectedFiles([...selectedFiles, ...newFiles]);
    e.target.value = null; // allow re-selecting same file
  }
  
  const handleDragStartStaging = (e, index) => setDraggedIdx(index);
  const handleDragEnterStaging = (e, index) => {
    if (draggedIdx === null || draggedIdx === index) return;
    const newFiles = [...selectedFiles];
    const draggedItem = newFiles[draggedIdx];
    newFiles.splice(draggedIdx, 1);
    newFiles.splice(index, 0, draggedItem);
    setSelectedFiles(newFiles);
    setDraggedIdx(index);
  }
  const handleDragEndStaging = () => setDraggedIdx(null);
  
  const handleDragStartEdit = (e, index) => setDraggedEditIdx(index);
  const handleDragEnterEdit = (e, index) => {
    if (draggedEditIdx === null || draggedEditIdx === index) return;
    const newImages = [...editProduct.images];
    const draggedItem = newImages[draggedEditIdx];
    newImages.splice(draggedEditIdx, 1);
    newImages.splice(index, 0, draggedItem);
    setEditProduct({...editProduct, images: newImages});
    setDraggedEditIdx(index);
  }
  const handleDragEndEdit = async () => {
    setDraggedEditIdx(null);
    const image_ids = editProduct.images.map(img => img.id);
    try {
      await api.put(`/api/admin/product-images/reorder/`, { image_ids });
      fetchData();
    } catch(err) { console.error("Failed to sync order", err); }
  }

  const formatCurrency = (value) => {
    const number = Number(value || 0);
    return number.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString('en-US');
  };

  function StatCard({ title, value, icon }) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '18px',
        padding: '1.5rem',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        border: '1px solid #f1f1f1',
        flex: 1,
        minWidth: '220px'
      }}>
        <div style={{ marginBottom: '0.7rem' }}>{icon}</div>
        <p style={{ margin: 0, color: '#777', fontWeight: '600' }}>{title}</p>
        <h2 style={{ margin: '0.4rem 0 0', color: '#333', fontSize: '2rem' }}>{value}</h2>
      </div>
    );
  }

  function StatCardSkeleton() {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '18px',
        padding: '1.5rem',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        border: '1px solid #f1f1f1',
        flex: 1,
        minWidth: '220px'
      }}>
        <div style={{ height: '32px', width: '32px', background: '#eee', borderRadius: '8px', marginBottom: '1rem' }} />
        <div style={{ height: '16px', width: '120px', background: '#eee', borderRadius: '8px', marginBottom: '0.8rem' }} />
        <div style={{ height: '32px', width: '160px', background: '#eee', borderRadius: '8px' }} />
      </div>
    );
  }

  // --- RENDERERS ---
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.keywords.toLowerCase().includes(searchTerm.toLowerCase()));

  if (auth.role !== 'Admin') return null;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Outfit' }}>
      <h1 style={{ color: '#333', fontSize: '2.5rem', fontWeight: '700', marginBottom: '1rem' }}>Admin System</h1>
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #eee', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <button onClick={()=>setActiveTab('products')} style={{ padding: '0.6rem 1.2rem', background: activeTab==='products'?'#333':'#f4f4f4', color: activeTab==='products'?'white':'#555', border: 'none', borderRadius: '25px', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: '600', transition: 'all 0.2s', boxShadow: activeTab==='products'?'0 4px 6px rgba(0,0,0,0.1)':'none' }}>Products Inventory</button>
        <button onClick={()=>setActiveTab('categories')} style={{ padding: '0.6rem 1.2rem', background: activeTab==='categories'?'#333':'#f4f4f4', color: activeTab==='categories'?'white':'#555', border: 'none', borderRadius: '25px', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: '600', transition: 'all 0.2s', boxShadow: activeTab==='categories'?'0 4px 6px rgba(0,0,0,0.1)':'none' }}>Category Management</button>
      </div>

      <div style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '2rem'
      }}>
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats?.total_revenue)}
              icon={<DollarSign size={28} color="#22c55e" />}
            />
            <StatCard
              title="Total Orders"
              value={formatNumber(stats?.total_orders)}
              icon={<ShoppingCart size={28} color="#3B82F6" />}
            />
            <StatCard
              title="Total Customers"
              value={formatNumber(stats?.total_customers)}
              icon={<Users size={28} color="#a855f7" />}
            />
          </>
        )}
      </div>

      {activeTab === 'categories' && (
        <div>
          <h2 style={{ color: '#444', fontWeight: '600' }}>Manage Categories</h2>
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input type="text" placeholder="New Category Name" value={catName} onChange={e=>setCatName(e.target.value)} required style={{ padding: '0.8rem', width: '250px', borderRadius: '12px', border: '2px solid #eee', fontFamily: 'Outfit', outlineColor: '#333' }}/>
            <button type="submit" style={{ padding: '0.8rem 1.5rem', background: '#333', color: 'white', border:'none', borderRadius: '25px', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: '600', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>+ Add Category</button>
          </form>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <thead><tr style={{ background: '#f4f4f4', color: '#555' }}><th style={{ padding: '1rem' }}>ID</th><th>Name</th><th>Actions</th></tr></thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem', color: '#666' }}>{c.id}</td>
                  <td style={{ fontWeight: '500' }}>{c.name}</td>
                  <td><button onClick={()=>handleDeleteCategory(c.id)} style={{ color: '#D32F2F', cursor: 'pointer', background: '#FFEBEE', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: '600', fontFamily: 'Outfit' }}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <h2 style={{ color: '#444', fontWeight: '600' }}>Product Catalog</h2>
            <button onClick={()=>setShowProductModal(true)} style={{ padding: '0.8rem 1.5rem', background: '#333', color: 'white', border:'none', borderRadius: '25px', cursor: 'pointer', fontWeight: '600', fontFamily: 'Outfit', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>+ Create Product</button>
          </div>
          <input type="text" placeholder="Search products by name or keyword..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{ padding: '0.8rem', width: '100%', marginBottom: '1.5rem', border: '2px solid #eee', borderRadius: '12px', fontFamily: 'Outfit', outlineColor: '#333', boxSizing: 'border-box' }}/>
          
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', color: '#555' }}>
                <th style={{ padding: '1rem' }}>Thumb</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem' }}>
                    <img src={p.images && p.images.length > 0 ? `${BACKEND_URL}${p.images[0].url}` : FALLBACK} alt="thumb" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px' }}/>
                  </td>
                  <td style={{ fontWeight: '600', color: '#333' }}>{p.name}</td>
                  <td style={{ color: '#666' }}>{p.category_name}</td>
                  <td style={{ color: '#333', fontWeight: '700' }}>${p.price}</td>
                  <td style={{ fontWeight: '600', color: p.stock > 0 ? '#333' : '#D32F2F' }}>{p.stock}</td>
                  <td>
                    <button onClick={()=>openEditModal(p)} style={{ marginRight: '0.5rem', cursor: 'pointer', padding: '0.4rem 0.8rem', background: '#eee', color: '#333', border: 'none', borderRadius: '8px', fontWeight: '600', fontFamily: 'Outfit' }}>Edit</button>
                    <button onClick={()=>handleDeleteProduct(p.id)} style={{ color: '#D32F2F', background: '#FFEBEE', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '0.4rem 0.8rem', fontWeight: '600', fontFamily: 'Outfit' }}>Delete</button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length===0 && <tr><td colSpan="6" style={{textAlign:'center', padding: '2rem', color: '#888'}}>No products found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* --- MODAL OVERLAY --- */}
      {showProductModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>{editProduct ? 'Edit Product' : 'Create New Product'}</h2>
              <button onClick={closeProductModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* LEFT SIDE: Text Payload */}
              <form onSubmit={handleProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label>Name <input required type="text" value={prodForm.name} onChange={e=>setProdForm({...prodForm, name: e.target.value})} style={{width:'100%', padding:'0.5rem'}}/></label>
                <label>Description <textarea value={prodForm.description} onChange={e=>setProdForm({...prodForm, description: e.target.value})} style={{width:'100%', padding:'0.5rem', height: '80px'}}/></label>
                <label>Keywords (tags) <input type="text" value={prodForm.keywords} onChange={e=>setProdForm({...prodForm, keywords: e.target.value})} style={{width:'100%', padding:'0.5rem'}}/></label>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ flex: 1 }}>Price ($) <input required type="number" step="0.01" min="0.01" value={prodForm.price} onChange={e=>setProdForm({...prodForm, price: e.target.value})} style={{width:'100%', padding:'0.5rem'}}/></label>
                  <label style={{ flex: 1 }}>Stock <input required type="number" min="0" value={prodForm.stock} onChange={e=>setProdForm({...prodForm, stock: e.target.value})} style={{width:'100%', padding:'0.5rem'}}/></label>
                </div>
                
                <label>Category
                  <select value={prodForm.category_id} onChange={e=>setProdForm({...prodForm, category_id: e.target.value})} style={{width:'100%', padding:'0.5rem'}}>
                    <option value="">Select a Category... (Optional)</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>

                {!editProduct && (
                  <div style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '4px' }}>
                    <label>Upload Initial Images <br/>
                      <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleFileSelect} style={{ marginTop: '0.5rem' }}/>
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                      {selectedFiles.map((f, i) => (
                        <div key={f.id} draggable onDragStart={e => handleDragStartStaging(e, i)} onDragEnter={e => handleDragEnterStaging(e, i)} onDragEnd={handleDragEndStaging} onDragOver={e => e.preventDefault()} style={{ position: 'relative', width: '80px', height: '80px', cursor: 'grab' }}>
                          <img src={f.preview} alt="staged" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: i===0?'2px solid #2e7d32':'1px solid #ccc' }}/>
                          {i===0 && <span style={{position:'absolute', bottom:0, left:0, background:'rgba(0,0,0,0.6)', color:'white', fontSize:'10px', width:'100%', textAlign:'center'}}>THUMBNAIL</span>}
                          <button type="button" onClick={() => setSelectedFiles(selectedFiles.filter(item => item.id !== f.id))} style={{ position:'absolute', top:'-5px', right:'-5px', background:'red', color:'white', border:'none', borderRadius:'50%', cursor:'pointer' }}>x</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button type="submit" style={{ padding: '0.75rem', background: '#0066cc', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}>
                  {editProduct ? 'Save Updates' : 'Publish Product'}
                </button>
              </form>

              {/* RIGHT SIDE: Gallery Manager (Only in Edit Mode) */}
              {editProduct && (
                <div style={{ background: '#fafafa', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd' }}>
                  <h3>Gallery Manager</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                    {editProduct.images && editProduct.images.length > 0 ? (
                      editProduct.images.map((img, i) => (
                        <div key={img.id} draggable onDragStart={e => handleDragStartEdit(e, i)} onDragEnter={e => handleDragEnterEdit(e, i)} onDragEnd={handleDragEndEdit} onDragOver={e => e.preventDefault()} style={{ position: 'relative', border: i===0?'2px solid #2e7d32':'1px solid #ccc', borderRadius: '4px', overflow: 'hidden', cursor: 'grab', transition: 'transform 0.2s' }}>
                          <img src={`${BACKEND_URL}${img.url}`} alt="gallery" style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }} />
                          {i===0 && <span style={{position:'absolute', bottom:0, background:'rgba(0,0,0,0.6)', color:'white', fontSize:'12px', width:'100%', textAlign:'center'}}>THUMBNAIL</span>}
                          <button type="button" onClick={() => handleSpecificImageDelete(img.id)} style={{ position: 'absolute', top: '2px', right: '2px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 'bold', lineHeight: '10px' }}>&times;</button>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: '#888', fontSize: '0.9rem' }}>No images attached.</p>
                    )}
                  </div>
                  
                  <div style={{ borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                    <h4>Append Single Image</h4>
                    <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleSpecificImageAppend} style={{ fontSize: '0.9rem' }}/>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
