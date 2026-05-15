import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AlertTriangle, Check, X, Loader2, ChevronDown, History, TrendingUp, TrendingDown, Package, DollarSign } from 'lucide-react';

const CELL_STATES = {
  IDLE: 'idle',
  EDITING: 'editing',
  SAVING: 'saving',
  SUCCESS: 'success',
  ERROR: 'error',
};

export default function QuickUpdates() {
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [avgPrice, setAvgPrice] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [cellStates, setCellStates] = useState({});
  const [cellErrors, setCellErrors] = useState({});
  const [editValues, setEditValues] = useState({});
  const [bulkAction, setBulkAction] = useState('increase_percent');
  const [bulkField, setBulkField] = useState('price');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loading, setLoading] = useState(true);
  const editRef = useRef(null);

  useEffect(() => {
    if (auth.role !== 'Admin') {
      navigate('/');
    } else {
      fetchData();
    }
  }, [auth, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, statsRes, logsRes] = await Promise.all([
        api.get('/api/products/'),
        api.get('/api/admin/products/price-stats/'),
        api.get('/api/admin/products/change-log/?limit=100'),
      ]);
      setProducts(prodRes.data.products);
      setAvgPrice(parseFloat(statsRes.data.avg_price) || 0);
      setChangeLogs(logsRes.data.logs);
    } catch (e) {
      console.error('Error fetching data', e);
    } finally {
      setLoading(false);
    }
  };

  const getCellKey = (productId, field) => `${productId}-${field}`;

  const setCellState = (productId, field, state) => {
    const key = getCellKey(productId, field);
    setCellStates(prev => ({ ...prev, [key]: state }));
  };

  const getCellState = (productId, field) => {
    const key = getCellKey(productId, field);
    return cellStates[key] || CELL_STATES.IDLE;
  };

  const setCellError = (productId, field, msg) => {
    const key = getCellKey(productId, field);
    setCellErrors(prev => ({ ...prev, [key]: msg }));
  };

  const clearCellError = (productId, field) => {
    const key = getCellKey(productId, field);
    setCellErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const startEditing = (productId, field, currentValue) => {
    const key = getCellKey(productId, field);
    setEditValues(prev => ({ ...prev, [key]: String(currentValue) }));
    setCellState(productId, field, CELL_STATES.EDITING);
    clearCellError(productId, field);
    setTimeout(() => {
      if (editRef.current) {
        editRef.current.focus();
        editRef.current.select();
      }
    }, 0);
  };

  const cancelEditing = (productId, field) => {
    const key = getCellKey(productId, field);
    setEditValues(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setCellState(productId, field, CELL_STATES.IDLE);
    clearCellError(productId, field);
  };

  const saveCell = async (productId, field) => {
    const key = getCellKey(productId, field);
    const value = editValues[key];

    if (field === 'price' && (isNaN(parseFloat(value)) || parseFloat(value) < 0.01)) {
      setCellError(productId, field, 'Price must be at least 0.01');
      setCellState(productId, field, CELL_STATES.ERROR);
      setTimeout(() => {
        setCellState(productId, field, CELL_STATES.EDITING);
      }, 2000);
      return;
    }

    if (field === 'stock' && (isNaN(parseInt(value)) || parseInt(value) < 0)) {
      setCellError(productId, field, 'Stock cannot be negative');
      setCellState(productId, field, CELL_STATES.ERROR);
      setTimeout(() => {
        setCellState(productId, field, CELL_STATES.EDITING);
      }, 2000);
      return;
    }

    setCellState(productId, field, CELL_STATES.SAVING);
    clearCellError(productId, field);

    try {
      const response = await api.patch(`/api/admin/products/${productId}/quick-update/`, {
        field,
        value: field === 'price' ? parseFloat(value) : parseInt(value),
      });

      setProducts(prev =>
        prev.map(p => {
          if (p.id !== productId) return p;
          if (field === 'price') return { ...p, price: response.data.new_value };
          if (field === 'stock') return { ...p, stock: response.data.new_value, is_available: response.data.is_available };
          return p;
        })
      );

      setCellState(productId, field, CELL_STATES.SUCCESS);
      setTimeout(() => {
        setCellState(productId, field, CELL_STATES.IDLE);
      }, 1200);

      setEditValues(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      fetchData();
    } catch (e) {
      const errorMsg = e.response?.data?.error || 'Update failed';
      setCellError(productId, field, errorMsg);
      setCellState(productId, field, CELL_STATES.ERROR);
      setTimeout(() => {
        setCellState(productId, field, CELL_STATES.EDITING);
      }, 2500);
    }
  };

  const handleKeyDown = (e, productId, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCell(productId, field);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing(productId, field);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      saveCell(productId, field);
    }
  };

  const handleBlur = (productId, field) => {
    setTimeout(() => {
      const state = getCellState(productId, field);
      if (state === CELL_STATES.EDITING) {
        saveCell(productId, field);
      }
    }, 150);
  };

  const toggleSelect = (productId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filtered = getFilteredProducts();
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const getFilteredProducts = useCallback(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const previewBulkChanges = () => {
    if (selectedIds.size === 0 || !bulkValue) return;

    const changes = [];
    const filteredProducts = products.filter(p => selectedIds.has(p.id));

    for (const p of filteredProducts) {
      const oldVal = bulkField === 'price' ? parseFloat(p.price) : p.stock;
      let newVal;

      if (bulkAction === 'set') {
        newVal = parseFloat(bulkValue);
      } else if (bulkAction === 'increase_percent') {
        newVal = oldVal * (1 + parseFloat(bulkValue) / 100);
      } else if (bulkAction === 'decrease_percent') {
        newVal = oldVal * (1 - parseFloat(bulkValue) / 100);
      } else if (bulkAction === 'increase_fixed' || bulkAction === 'add_units') {
        newVal = oldVal + parseFloat(bulkValue);
      } else if (bulkAction === 'decrease_fixed') {
        newVal = oldVal - parseFloat(bulkValue);
      }

      if (bulkField === 'price') {
        newVal = Math.round(newVal * 100) / 100;
      } else {
        newVal = Math.round(newVal);
      }

      const hasError = (bulkField === 'price' && newVal < 0.01) || (bulkField === 'stock' && newVal < 0);

      changes.push({
        product_id: p.id,
        product_name: p.name,
        old_value: oldVal,
        new_value: newVal,
        has_error: hasError,
      });
    }

    setPendingChanges(changes);
  };

  const applyBulkChanges = async () => {
    if (pendingChanges.length === 0) return;
    const validChanges = pendingChanges.filter(c => !c.has_error);
    if (validChanges.length === 0) return;

    setBulkLoading(true);
    try {
      const response = await api.post('/api/admin/products/bulk-update/', {
        product_ids: validChanges.map(c => c.product_id),
        field: bulkField,
        action: bulkAction,
        value: parseFloat(bulkValue),
      });

      if (response.data.updated.length > 0) {
        fetchData();
      }

      setPendingChanges([]);
      setBulkValue('');
      setSelectedIds(new Set());
    } catch (e) {
      console.error('Bulk update failed', e);
    } finally {
      setBulkLoading(false);
    }
  };

  const getStockColor = (stock) => {
    if (stock === 0) return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
    if (stock < 5) return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
    return { bg: 'transparent', text: '#333', border: 'transparent' };
  };

  const getPriceColor = (price) => {
    if (avgPrice > 0 && parseFloat(price) < avgPrice * 0.5) return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
    return { bg: 'transparent', text: '#333', border: 'transparent' };
  };

  const getCellBgColor = (productId, field) => {
    const state = getCellState(productId, field);
    if (state === CELL_STATES.SAVING) return '#EFF6FF';
    if (state === CELL_STATES.SUCCESS) return '#F0FDF4';
    if (state === CELL_STATES.ERROR) return '#FEF2F2';
    return null;
  };

  const renderEditableCell = (product, field) => {
    const state = getCellState(product.id, field);
    const key = getCellKey(product.id, field);
    const editValue = editValues[key];
    const cellError = cellErrors[key];
    const overrideBg = getCellBgColor(product.id, field);

    const threshold = field === 'stock' ? getStockColor(product.stock) : getPriceColor(product.price);
    const bgColor = overrideBg || threshold.bg;

    if (state === CELL_STATES.EDITING) {
      return (
        <div style={{ position: 'relative' }}>
          <input
            ref={editRef}
            type={field === 'price' ? 'number' : 'number'}
            step={field === 'price' ? '0.01' : '1'}
            min={field === 'price' ? '0.01' : '0'}
            value={editValue}
            onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
            onKeyDown={(e) => handleKeyDown(e, product.id, field)}
            onBlur={() => handleBlur(product.id, field)}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              border: '2px solid #3B82F6',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontFamily: 'Outfit',
              outline: 'none',
              background: '#fff',
              boxSizing: 'border-box',
            }}
          />
          {cellError && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 10,
              background: '#DC2626',
              color: 'white',
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              marginTop: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}>
              {cellError}
            </div>
          )}
        </div>
      );
    }

    if (state === CELL_STATES.SAVING) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: bgColor, borderRadius: '6px' }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.85rem', color: '#3B82F6' }}>Saving...</span>
        </div>
      );
    }

    if (state === CELL_STATES.SUCCESS) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: bgColor, borderRadius: '6px' }}>
          <Check size={14} color="#16A34A" />
          <span style={{ fontSize: '0.85rem', color: '#16A34A', fontWeight: '600' }}>Saved</span>
        </div>
      );
    }

    if (state === CELL_STATES.ERROR) {
      return (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: bgColor, borderRadius: '6px' }}>
            <X size={14} color="#DC2626" />
            <span style={{ fontSize: '0.85rem', color: '#DC2626', fontWeight: '600' }}>
              {editValues[key]}
            </span>
          </div>
          {cellError && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 10,
              background: '#DC2626',
              color: 'white',
              padding: '0.3rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              marginTop: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}>
              {cellError}
            </div>
          )}
        </div>
      );
    }

    const displayValue = field === 'price'
      ? `$${parseFloat(product.price).toFixed(2)}`
      : product.stock;

    return (
      <div
        onClick={() => startEditing(product.id, field, field === 'price' ? parseFloat(product.price) : product.stock)}
        style={{
          padding: '0.4rem 0.6rem',
          borderRadius: '6px',
          cursor: 'pointer',
          background: bgColor,
          border: `1px solid ${threshold.border}`,
          transition: 'all 0.15s',
          fontWeight: field === 'price' ? '700' : '600',
          color: threshold.text,
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}
        onMouseEnter={(e) => {
          if (state === CELL_STATES.IDLE) {
            e.currentTarget.style.background = '#F3F4F6';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }
        }}
        onMouseLeave={(e) => {
          if (state === CELL_STATES.IDLE) {
            e.currentTarget.style.background = threshold.bg;
            e.currentTarget.style.borderColor = threshold.border;
          }
        }}
      >
        {field === 'stock' && product.stock === 0 && <AlertTriangle size={12} color="#DC2626" />}
        {field === 'price' && avgPrice > 0 && parseFloat(product.price) < avgPrice * 0.5 && <TrendingDown size={12} color="#D97706" />}
        {displayValue}
      </div>
    );
  };

  const filteredProducts = getFilteredProducts();

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Outfit', textAlign: 'center' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#3B82F6' }} />
        <p style={{ color: '#666', marginTop: '1rem' }}>Loading Quick Updates...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Outfit' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#333', fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>Quick Updates</h2>
          <p style={{ color: '#888', margin: '0.3rem 0 0', fontSize: '0.9rem' }}>
            Click any Price or Stock cell to edit inline. Press Enter to save, Escape to cancel.
          </p>
        </div>
        <button
          onClick={() => setShowLogs(!showLogs)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            background: showLogs ? '#333' : '#f4f4f4',
            color: showLogs ? 'white' : '#555',
            border: 'none',
            borderRadius: '25px',
            cursor: 'pointer',
            fontFamily: 'Outfit',
            fontWeight: '600',
          }}
        >
          <History size={16} />
          Change Log
        </button>
      </div>

      {/* Bulk Toolbar */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '1.2rem 1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        border: '1px solid #f0f0f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={18} color="#3B82F6" />
            <span style={{ fontWeight: '700', color: '#333', fontSize: '0.95rem' }}>Bulk Actions</span>
            <span style={{
              background: '#EFF6FF',
              color: '#3B82F6',
              padding: '0.15rem 0.5rem',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: '700',
            }}>{selectedIds.size} selected</span>
          </div>

          <select
            value={bulkField}
            onChange={(e) => { setBulkField(e.target.value); setPendingChanges([]); }}
            style={{
              padding: '0.5rem 0.8rem',
              border: '2px solid #eee',
              borderRadius: '10px',
              fontFamily: 'Outfit',
              fontWeight: '500',
              background: 'white',
            }}
          >
            <option value="price">Price</option>
            <option value="stock">Stock</option>
          </select>

          <select
            value={bulkAction}
            onChange={(e) => { setBulkAction(e.target.value); setPendingChanges([]); }}
            style={{
              padding: '0.5rem 0.8rem',
              border: '2px solid #eee',
              borderRadius: '10px',
              fontFamily: 'Outfit',
              fontWeight: '500',
              background: 'white',
            }}
          >
            {bulkField === 'price' ? (
              <>
                <option value="increase_percent">Increase by %</option>
                <option value="decrease_percent">Decrease by %</option>
                <option value="increase_fixed">Increase by $</option>
                <option value="decrease_fixed">Decrease by $</option>
                <option value="set">Set to value</option>
              </>
            ) : (
              <>
                <option value="add_units">Add units</option>
                <option value="increase_percent">Increase by %</option>
                <option value="decrease_percent">Decrease by %</option>
                <option value="decrease_fixed">Remove units</option>
                <option value="set">Set to value</option>
              </>
            )}
          </select>

          <input
            type="number"
            step={bulkField === 'price' ? '0.01' : '1'}
            min="0"
            placeholder={bulkField === 'price' ? '0.00' : '0'}
            value={bulkValue}
            onChange={(e) => { setBulkValue(e.target.value); setPendingChanges([]); }}
            style={{
              padding: '0.5rem 0.8rem',
              border: '2px solid #eee',
              borderRadius: '10px',
              fontFamily: 'Outfit',
              width: '120px',
            }}
          />

          <button
            onClick={previewBulkChanges}
            disabled={selectedIds.size === 0 || !bulkValue}
            style={{
              padding: '0.5rem 1.2rem',
              background: selectedIds.size === 0 || !bulkValue ? '#e5e7eb' : '#3B82F6',
              color: selectedIds.size === 0 || !bulkValue ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: selectedIds.size === 0 || !bulkValue ? 'not-allowed' : 'pointer',
              fontFamily: 'Outfit',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <ChevronDown size={14} />
            Review Changes
          </button>
        </div>

        {/* Review Changes Footer */}
        {pendingChanges.length > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#F9FAFB',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
              <h4 style={{ margin: 0, color: '#333', fontSize: '0.95rem' }}>
                Review Changes ({pendingChanges.filter(c => !c.has_error).length} valid, {pendingChanges.filter(c => c.has_error).length} errors)
              </h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setPendingChanges([])}
                  style={{
                    padding: '0.4rem 1rem',
                    background: '#f4f4f4',
                    color: '#555',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontFamily: 'Outfit',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={applyBulkChanges}
                  disabled={bulkLoading || pendingChanges.every(c => c.has_error)}
                  style={{
                    padding: '0.4rem 1rem',
                    background: pendingChanges.every(c => c.has_error) ? '#e5e7eb' : '#16A34A',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: pendingChanges.every(c => c.has_error) ? 'not-allowed' : 'pointer',
                    fontFamily: 'Outfit',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  {bulkLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                  Apply All
                </button>
              </div>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F3F4F6' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#666' }}>Product</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#666' }}>Current</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', color: '#666' }}></th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#666' }}>New</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', color: '#666' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingChanges.map((change, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '0.5rem', fontWeight: '500' }}>{change.product_name}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: '#666' }}>
                        {bulkField === 'price' ? `$${change.old_value.toFixed(2)}` : change.old_value}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        {change.has_error ? (
                          <X size={14} color="#DC2626" />
                        ) : change.new_value > change.old_value ? (
                          <TrendingUp size={14} color="#16A34A" />
                        ) : (
                          <TrendingDown size={14} color="#DC2626" />
                        )}
                      </td>
                      <td style={{
                        padding: '0.5rem',
                        textAlign: 'right',
                        fontWeight: '700',
                        color: change.has_error ? '#DC2626' : change.new_value > change.old_value ? '#16A34A' : '#DC2626',
                      }}>
                        {bulkField === 'price' ? `$${change.new_value.toFixed(2)}` : change.new_value}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        {change.has_error ? (
                          <span style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: '600' }}>
                            {bulkField === 'price' ? 'Below min' : 'Negative'}
                          </span>
                        ) : (
                          <Check size={14} color="#16A34A" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search products by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '0.8rem 1rem',
            width: '100%',
            border: '2px solid #eee',
            borderRadius: '12px',
            fontFamily: 'Outfit',
            outlineColor: '#333',
            boxSizing: 'border-box',
            fontSize: '0.95rem',
          }}
        />
      </div>

      {/* Quick Edit Table */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
        border: '1px solid #f0f0f0',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', color: '#555' }}>
              <th style={{ padding: '0.8rem 1rem', width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Product Name
              </th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <DollarSign size={14} />
                  Price
                  {avgPrice > 0 && <span style={{ fontSize: '0.7rem', color: '#999', fontWeight: '400' }}>(avg: ${avgPrice.toFixed(2)})</span>}
                </div>
              </th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Package size={14} />
                  Stock
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p, idx) => {
              const isSelected = selectedIds.has(p.id);
              return (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: isSelected ? '#EFF6FF' : idx % 2 === 0 ? '#fff' : '#FAFBFC',
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.id)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </td>
                  <td style={{ padding: '0.6rem 1rem' }}>
                    <div style={{ fontWeight: '600', color: '#333', fontSize: '0.95rem' }}>{p.name}</div>
                    {p.category_name && (
                      <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>{p.category_name}</div>
                    )}
                  </td>
                  <td style={{ padding: '0.6rem 1rem' }}>
                    {renderEditableCell(p, 'price')}
                  </td>
                  <td style={{ padding: '0.6rem 1rem' }}>
                    {renderEditableCell(p, 'stock')}
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '1.5rem',
        marginTop: '1rem',
        padding: '0.8rem 1rem',
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #f0f0f0',
        fontSize: '0.8rem',
        color: '#666',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#FEE2E2', border: '1px solid #FECACA' }} />
          <span>Out of stock</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#FEF3C7', border: '1px solid #FDE68A' }} />
          <span>Low stock (&lt;5) or price below 50% avg</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#F0FDF4', border: '1px solid #BBF7D0' }} />
          <span>Recently saved</span>
        </div>
      </div>

      {/* Change Log Panel */}
      {showLogs && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '450px',
          background: '#fff',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Outfit',
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ margin: 0, color: '#333' }}>Change History</h3>
            <button
              onClick={() => setShowLogs(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666',
              }}
            >
              &times;
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {changeLogs.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>No changes recorded yet.</p>
            ) : (
              changeLogs.map(log => (
                <div
                  key={log.id}
                  style={{
                    padding: '0.8rem',
                    borderBottom: '1px solid #f3f4f6',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#333' }}>{log.product_name}</span>
                    <span style={{
                      background: log.source === 'bulk' ? '#EFF6FF' : '#F0FDF4',
                      color: log.source === 'bulk' ? '#3B82F6' : '#16A34A',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                    }}>
                      {log.source}
                    </span>
                  </div>
                  <div style={{ color: '#666', marginTop: '0.3rem' }}>
                    <span style={{ textTransform: 'capitalize' }}>{log.field_changed}</span>:{' '}
                    <span style={{ textDecoration: 'line-through', color: '#999' }}>{log.old_value}</span>
                    {' → '}
                    <span style={{ fontWeight: '600', color: '#333' }}>{log.new_value}</span>
                  </div>
                  <div style={{ color: '#999', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                    {log.changed_by && `by ${log.changed_by}`} · {new Date(log.changed_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
