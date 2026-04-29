import React, { useEffect, useState } from 'react';
import { Card, Button, Input } from '@jukebox/ui';
import { useBarOwnerStore } from '../../stores/barOwnerStore';
import { EventConfigEditor } from '../../components/EventConfigEditor';
import { api } from '../../lib/api';

interface VenueProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  basePrice: number;
  price: number;
}

const PIX_KEY_TYPES = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'EVP', label: 'Random Key (EVP)' },
] as const;

export const OwnerSettingsPage: React.FC = () => {
  const { venue, playlists, fetchVenue, fetchPlaylists, updatePricing, updateSettings } = useBarOwnerStore();

  const [songPrice, setSongPrice] = useState(2.0);
  const [priorityPrice, setPriorityPrice] = useState(5.0);
  const [autoPlayPlaylistId, setAutoPlayPlaylistId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Product pricing state
  const [products, setProducts] = useState<VenueProduct[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsSaving, setProductsSaving] = useState(false);
  const [productsSaved, setProductsSaved] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Pix key state
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('CPF');
  const [pixSaving, setPixSaving] = useState(false);
  const [pixSaved, setPixSaved] = useState(false);
  const [pixError, setPixError] = useState('');

  useEffect(() => {
    fetchVenue();
    fetchPlaylists();
  }, []);

  useEffect(() => {
    if (venue?.settings) {
      setSongPrice(venue.settings.songPrice || 2.0);
      setPriorityPrice(venue.settings.priorityPrice || 5.0);
      setAutoPlayPlaylistId(venue.settings.autoPlayPlaylistId || '');
    }
    if (venue) {
      setPixKey((venue as any).pixKey || '');
      setPixKeyType((venue as any).pixKeyType || 'CPF');
    }
  }, [venue]);

  // Load products when venue is available
  useEffect(() => {
    if (!venue?.id) return;

    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError(null);
      try {
        const { data } = await api.get(`/products/venue/${venue.id}`);
        const loadedProducts: VenueProduct[] = data.data.products || [];
        setProducts(loadedProducts);
        // Initialize edited prices with current venue prices
        const initial: Record<string, number> = {};
        for (const p of loadedProducts) {
          initial[p.id] = p.price;
        }
        setEditedPrices(initial);
      } catch {
        setProductsError('Failed to load product pricing');
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, [venue?.id]);

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      await updatePricing(songPrice, priorityPrice);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateSettings({ autoPlayPlaylistId: autoPlayPlaylistId || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleSavePixKey = async () => {
    if (!venue?.id) return;
    if (!pixKey.trim()) { setPixError('Enter your Pix key'); return; }
    setPixSaving(true);
    setPixError('');
    try {
      await api.put('/payments/pix/venue-key', {
        venueId: venue.id,
        pixKey: pixKey.trim(),
        pixKeyType,
      });
      setPixSaved(true);
      setTimeout(() => setPixSaved(false), 2000);
    } catch (err: any) {
      setPixError(err.response?.data?.error || 'Failed to save Pix key');
    } finally {
      setPixSaving(false);
    }
  };

  const handlePriceChange = (productId: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setEditedPrices((prev) => ({ ...prev, [productId]: num }));
    }
  };

  const hasProductChanges = products.some((p) => editedPrices[p.id] !== p.price);

  const handleSaveProductPrices = async () => {
    if (!venue?.id) return;

    const changedPrices = products
      .filter((p) => editedPrices[p.id] !== p.price)
      .map((p) => ({ productId: p.id, price: editedPrices[p.id] }));

    if (changedPrices.length === 0) return;

    setProductsSaving(true);
    setProductsError(null);
    try {
      await api.put(`/products/venue/${venue.id}/prices`, { prices: changedPrices });
      // Update local state to reflect saved prices
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          price: editedPrices[p.id] ?? p.price,
        }))
      );
      setProductsSaved(true);
      setTimeout(() => setProductsSaved(false), 2000);
    } catch {
      setProductsError('Failed to save product prices');
    } finally {
      setProductsSaving(false);
    }
  };

  const groupedProducts = products.reduce<Record<string, VenueProduct[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Settings</h2>

      <div className="space-y-6 max-w-lg">
        {/* Pricing */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-jb-text-primary mb-4">Song Pricing</h3>
          <div className="space-y-4">
            <Input
              label="Regular Song Price (R$)"
              type="number"
              step="0.01"
              value={String(songPrice)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSongPrice(parseFloat(e.target.value) || 0)}
            />
            <p className="text-jb-text-secondary text-xs">= R$ {songPrice.toFixed(2)} per song (e.g., enter 2 for R$ 2.00)</p>
            <Input
              label="VIP / Priority Price (R$)"
              type="number"
              step="0.01"
              value={String(priorityPrice)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPriorityPrice(parseFloat(e.target.value) || 0)}
            />
            <p className="text-jb-text-secondary text-xs">= R$ {priorityPrice.toFixed(2)} per VIP song (e.g., enter 5 for R$ 5.00)</p>
            <Button variant="primary" fullWidth loading={saving} onClick={handleSavePricing}>
              {saved ? 'Saved!' : 'Save Pricing'}
            </Button>
          </div>
        </Card>

        {/* Pix Key */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-jb-text-primary mb-2">Pix Key</h3>
          <p className="text-jb-text-secondary text-sm mb-4">
            Set your Pix key to receive payments from customers. This is the bank account where song payments will be deposited.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-jb-text-secondary text-xs mb-1">Key Type</label>
              <select
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
                className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg text-jb-text-primary px-4 py-3 focus:outline-none focus:border-jb-accent-purple"
              >
                {PIX_KEY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <Input
              label={`Pix Key (${pixKeyType})`}
              placeholder={
                pixKeyType === 'CPF' ? '000.000.000-00'
                : pixKeyType === 'CNPJ' ? '00.000.000/0000-00'
                : pixKeyType === 'EMAIL' ? 'you@email.com'
                : pixKeyType === 'PHONE' ? '+5511999999999'
                : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
              }
              value={pixKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPixKey(e.target.value)}
            />
            {pixError && <p className="text-jb-highlight-pink text-xs">{pixError}</p>}
            <Button variant="primary" fullWidth loading={pixSaving} onClick={handleSavePixKey}>
              {pixSaved ? 'Saved!' : 'Save Pix Key'}
            </Button>
          </div>
        </Card>

        {/* Auto-Play Playlist */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-jb-text-primary mb-4">Auto-Play Playlist</h3>
          <p className="text-jb-text-secondary text-sm mb-4">
            Select a playlist to play when the queue is empty
          </p>
          <div className="space-y-3">
            <select
              value={autoPlayPlaylistId}
              onChange={(e) => setAutoPlayPlaylistId(e.target.value)}
              className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg text-jb-text-primary px-4 py-3 focus:outline-none focus:border-jb-accent-purple"
            >
              <option value="">None (silence when queue is empty)</option>
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.name} ({pl.songCount} songs)</option>
              ))}
            </select>
            <Button variant="secondary" fullWidth loading={saving} onClick={handleSaveSettings}>
              Save Playlist Setting
            </Button>
          </div>
        </Card>

        {/* Product Pricing */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-jb-text-primary mb-2">Product Pricing</h3>
          <p className="text-jb-text-secondary text-sm mb-4">
            Set custom prices for your venue. Leave at base price or adjust per product.
          </p>

          {productsLoading ? (
            <p className="text-jb-text-secondary text-sm text-center py-4">Loading products...</p>
          ) : productsError && products.length === 0 ? (
            <p className="text-jb-highlight-pink text-sm text-center py-4">{productsError}</p>
          ) : products.length === 0 ? (
            <p className="text-jb-text-secondary text-sm text-center py-4">No products available</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                <div key={category}>
                  <p className="text-jb-text-secondary text-xs uppercase tracking-wide mb-2">{category}</p>
                  <div className="space-y-3">
                    {categoryProducts.map((product) => (
                      <div key={product.id} className="flex items-center gap-3 p-3 rounded-lg bg-jb-bg-secondary/50 border border-white/5">
                        <div className="flex-1 min-w-0">
                          <p className="text-jb-text-primary text-sm font-medium truncate">{product.name}</p>
                          <p className="text-jb-text-secondary text-xs">
                            Base: R$ {product.basePrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="w-28 flex-shrink-0">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-jb-text-secondary text-xs">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editedPrices[product.id] ?? product.price}
                              onChange={(e) => handlePriceChange(product.id, e.target.value)}
                              className="w-full bg-jb-bg-primary border border-white/10 rounded text-jb-text-primary text-sm pl-8 pr-2 py-1.5 focus:outline-none focus:border-jb-accent-purple text-right"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {productsError && (
                <p className="text-jb-highlight-pink text-sm text-center">{productsError}</p>
              )}

              <Button
                variant="primary"
                fullWidth
                loading={productsSaving}
                onClick={handleSaveProductPrices}
                disabled={!hasProductChanges}
              >
                {productsSaved ? 'Saved!' : hasProductChanges ? 'Save Product Prices' : 'No Changes'}
              </Button>
            </div>
          )}
        </Card>

        {/* Special Events Configuration — same source of truth as admin
            (PUT /events/config/venue/:id), so admin and bar owner stay in sync. */}
        {venue?.id && (
          <Card className="p-6">
            <h3 className="text-lg font-bold text-jb-text-primary mb-2">Special Events</h3>
            <p className="text-jb-text-secondary text-sm mb-4">
              Prices and durations for silence, voice messages, photos, videos, reactions and birthdays at your venue. Changes here are also visible to admins and vice-versa.
            </p>
            <EventConfigEditor venueId={venue.id} />
          </Card>
        )}
      </div>
    </div>
  );
};
