import React, { useEffect, useState, useCallback } from 'react';
import { Card, Skeleton, Button, Input, Modal } from '@jukebox/ui';
import { api } from '../../lib/api';

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  isActive: boolean;
  sortOrder: number;
  metadata: Record<string, unknown>;
  comboItems?: { id: string; quantity: number; product: { id: string; code: string; name: string; basePrice: number } }[];
}

const categoryColor = (c: string) => {
  if (c === 'MUSIC') return 'text-jb-accent-green bg-jb-accent-green/10 border-jb-accent-green/30';
  if (c === 'SPECIAL_EVENT') return 'text-jb-accent-purple bg-jb-accent-purple/10 border-jb-accent-purple/30';
  return 'text-jb-highlight-pink bg-jb-highlight-pink/10 border-jb-highlight-pink/30';
};

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/products/all');
      setProducts(res.data.data.products);
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = categoryFilter ? products.filter(p => p.category === categoryFilter) : products;

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/products', {
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || 'SPECIAL_EVENT',
        basePrice: parseFloat(formData.basePrice || '0'),
      });
      setCreateModal(false);
      setFormData({});
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editProduct) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {};
      if (formData.name && formData.name !== editProduct.name) payload.name = formData.name;
      if (formData.description !== undefined) payload.description = formData.description || null;
      if (formData.basePrice) payload.basePrice = parseFloat(formData.basePrice);
      if (formData.isActive !== undefined) payload.isActive = formData.isActive === 'true';
      if (formData.sortOrder) payload.sortOrder = parseInt(formData.sortOrder);
      await api.put(`/products/${editProduct.id}`, payload);
      setEditProduct(null);
      setFormData({});
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!window.confirm(`Deactivate product "${name}"?`)) return;
    try {
      await api.delete(`/products/${id}`);
      loadProducts();
    } catch (err: any) {
      window.alert(err.response?.data?.error || 'Failed to deactivate');
    }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setFormData({
      name: p.name,
      description: p.description || '',
      basePrice: p.basePrice.toString(),
      isActive: p.isActive.toString(),
      sortOrder: p.sortOrder.toString(),
    });
    setError('');
  };

  const categoryCounts = {
    MUSIC: products.filter(p => p.category === 'MUSIC').length,
    SPECIAL_EVENT: products.filter(p => p.category === 'SPECIAL_EVENT').length,
    COMBO: products.filter(p => p.category === 'COMBO').length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-jb-text-primary">Products & Pricing</h2>
        <Button variant="primary" onClick={() => { setCreateModal(true); setFormData({ category: 'SPECIAL_EVENT' }); setError(''); }}>
          + New Product
        </Button>
      </div>

      {/* Category filters */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['MUSIC', 'SPECIAL_EVENT', 'COMBO'] as const).map(c => (
          <button
            key={c}
            onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
            className={`p-3 rounded-xl border text-center transition-all ${
              categoryFilter === c ? categoryColor(c) + ' ring-1 ring-white/20' : 'bg-jb-bg-secondary/50 border-white/5 hover:border-white/10'
            }`}
          >
            <p className={`text-2xl font-bold ${categoryFilter === c ? '' : 'text-jb-text-primary'}`}>{categoryCounts[c]}</p>
            <p className="text-[10px] uppercase tracking-wider text-jb-text-secondary">{c.replace('_', ' ')}</p>
          </button>
        ))}
      </div>

      {/* Product list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height="72px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-jb-text-secondary text-center py-20">No products found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => (
            <Card key={product.id} className={`p-3 sm:p-4 ${!product.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-start sm:items-center justify-between gap-2">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                    <p className="text-jb-text-primary font-medium text-sm sm:text-base break-words">{product.name}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${categoryColor(product.category)}`}>
                      {product.category.replace('_', ' ')}
                    </span>
                    {!product.isActive && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border text-red-400 bg-red-400/10 border-red-400/30 whitespace-nowrap">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-jb-text-secondary text-xs break-words">
                    Code: <span className="font-mono text-jb-accent-green">{product.code}</span>
                    {' | Base Price: '}<span className="text-jb-accent-green font-bold">R${product.basePrice.toFixed(2)}</span>
                    {product.description && <><br className="sm:hidden" /><span className="hidden sm:inline"> | </span>{product.description}</>}
                  </p>
                  {product.comboItems && product.comboItems.length > 0 && (
                    <p className="text-jb-text-secondary text-xs mt-0.5 break-words">
                      Includes: {product.comboItems.map(ci => `${ci.product.name}${ci.quantity > 1 ? ` x${ci.quantity}` : ''}`).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => openEdit(product)}
                    className="p-2 rounded-lg hover:bg-white/10 text-jb-text-secondary hover:text-jb-accent-green transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {product.isActive && (
                    <button
                      onClick={() => handleDeactivate(product.id, product.name)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-jb-text-secondary hover:text-red-400 transition-colors"
                      title="Deactivate"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create Product">
        <div className="space-y-4">
          <Input label="Code *" placeholder="e.g. SILENCE_90S" value={formData.code || ''} onChange={(e) => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
          <Input label="Name *" value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
          <Input label="Description" value={formData.description || ''} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} />
          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">Category</label>
            <select
              value={formData.category || 'SPECIAL_EVENT'}
              onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
              className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg px-3 py-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green"
            >
              <option value="MUSIC">Music</option>
              <option value="SPECIAL_EVENT">Special Event</option>
              <option value="COMBO">Combo</option>
            </select>
          </div>
          <Input label="Base Price (R$)" type="number" step="0.01" min="0" value={formData.basePrice || ''} onChange={(e) => setFormData(p => ({ ...p, basePrice: e.target.value }))} />
          {error && <p className="text-jb-highlight-pink text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button variant="primary" fullWidth loading={saving} onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editProduct} onClose={() => setEditProduct(null)} title="Edit Product">
        <div className="space-y-4">
          <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
          <Input label="Description" value={formData.description || ''} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} />
          <Input label="Base Price (R$)" type="number" step="0.01" min="0" value={formData.basePrice || ''} onChange={(e) => setFormData(p => ({ ...p, basePrice: e.target.value }))} />
          <Input label="Sort Order" type="number" value={formData.sortOrder || ''} onChange={(e) => setFormData(p => ({ ...p, sortOrder: e.target.value }))} />
          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">Status</label>
            <select
              value={formData.isActive || 'true'}
              onChange={(e) => setFormData(p => ({ ...p, isActive: e.target.value }))}
              className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg px-3 py-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          {error && <p className="text-jb-highlight-pink text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setEditProduct(null)}>Cancel</Button>
            <Button variant="primary" fullWidth loading={saving} onClick={handleUpdate}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
