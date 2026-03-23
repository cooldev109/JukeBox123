import React, { useEffect, useState, useCallback } from 'react';
import { Card, Skeleton, Button, Input, Modal } from '@jukebox/ui';
import { api } from '../../lib/api';

interface Region {
  id: string;
  code: string;
  name: string;
  _count: { venues: number; catalogEntries: number };
}

interface CatalogEntry {
  id: string;
  regionId: string;
  genreId: string;
  priority: number;
  genre?: { id: string; name: string };
}

interface Genre {
  id: string;
  name: string;
}

export const AdminRegionsPage: React.FC = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [addEntryModal, setAddEntryModal] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formGenreId, setFormGenreId] = useState('');
  const [formPriority, setFormPriority] = useState('0');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRegions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/regions');
      setRegions(data.data?.regions || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCatalog = useCallback(async (regionId: string) => {
    setCatalogLoading(true);
    try {
      const { data } = await api.get(`/regions/${regionId}/catalog`);
      setCatalogEntries(data.data?.entries || []);
    } catch {
      setCatalogEntries([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const fetchGenres = useCallback(async () => {
    try {
      const { data } = await api.get('/catalog/genres');
      setGenres(data.data?.genres || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  const handleSelectRegion = (region: Region) => {
    setSelectedRegion(region);
    fetchCatalog(region.id);
  };

  const handleBackToList = () => {
    setSelectedRegion(null);
    setCatalogEntries([]);
  };

  // Create region
  const openCreate = () => {
    setFormCode('');
    setFormName('');
    setError('');
    setCreateModal(true);
  };

  const handleCreate = async () => {
    if (!formCode.trim() || !formName.trim()) {
      setError('Code and name are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/regions', { code: formCode.trim(), name: formName.trim() });
      setCreateModal(false);
      fetchRegions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create region');
    } finally {
      setSaving(false);
    }
  };

  // Edit region
  const openEdit = (region: Region) => {
    setFormCode(region.code);
    setFormName(region.name);
    setError('');
    setEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedRegion) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, string> = {};
      if (formName.trim()) payload.name = formName.trim();
      if (formCode.trim()) payload.code = formCode.trim();
      await api.put(`/regions/${selectedRegion.id}`, payload);
      setEditModal(false);
      fetchRegions();
      // Update selected region name in place
      setSelectedRegion((prev) =>
        prev ? { ...prev, name: formName.trim() || prev.name, code: formCode.trim() || prev.code } : prev,
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update region');
    } finally {
      setSaving(false);
    }
  };

  // Add catalog entry
  const openAddEntry = () => {
    setFormGenreId('');
    setFormPriority('0');
    setError('');
    if (genres.length === 0) fetchGenres();
    setAddEntryModal(true);
  };

  const handleAddEntry = async () => {
    if (!selectedRegion || !formGenreId) {
      setError('Please select a genre');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/regions/${selectedRegion.id}/catalog`, {
        genreId: formGenreId,
        priority: parseInt(formPriority, 10) || 0,
      });
      setAddEntryModal(false);
      fetchCatalog(selectedRegion.id);
      // Update count
      setSelectedRegion((prev) =>
        prev ? { ...prev, _count: { ...prev._count, catalogEntries: prev._count.catalogEntries + 1 } } : prev,
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add catalog entry');
    } finally {
      setSaving(false);
    }
  };

  // Remove catalog entry
  const handleRemoveEntry = async (entryId: string) => {
    if (!selectedRegion) return;
    if (!window.confirm('Remove this catalog entry?')) return;
    try {
      await api.delete(`/regions/${selectedRegion.id}/catalog/${entryId}`);
      setCatalogEntries((prev) => prev.filter((e) => e.id !== entryId));
      setSelectedRegion((prev) =>
        prev ? { ...prev, _count: { ...prev._count, catalogEntries: Math.max(0, prev._count.catalogEntries - 1) } } : prev,
      );
    } catch (err: any) {
      window.alert(err.response?.data?.error || 'Failed to remove entry');
    }
  };

  // Region detail view (catalog)
  if (selectedRegion) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleBackToList}
            className="p-2 rounded-lg hover:bg-white/10 text-jb-text-secondary hover:text-jb-accent-green transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-jb-text-primary">
              {selectedRegion.name}{' '}
              <span className="text-jb-text-secondary text-base font-normal">({selectedRegion.code})</span>
            </h2>
            <p className="text-jb-text-secondary text-sm">
              {selectedRegion._count.venues} venues &middot; {selectedRegion._count.catalogEntries} catalog entries
            </p>
          </div>
          <Button variant="ghost" onClick={() => openEdit(selectedRegion)}>
            Edit Region
          </Button>
          <Button variant="primary" onClick={openAddEntry}>
            + Add Entry
          </Button>
        </div>

        {catalogLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="56px" rounded="lg" className="w-full" />
            ))}
          </div>
        ) : catalogEntries.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-jb-text-secondary text-lg mb-2">No catalog entries yet</p>
            <p className="text-jb-text-secondary/60 text-sm mb-4">
              Add genres to this region's catalog to customize the music selection.
            </p>
            <Button variant="primary" onClick={openAddEntry}>
              + Add First Entry
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {catalogEntries.map((entry) => (
              <Card key={entry.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-jb-accent-purple/10 border border-jb-accent-purple/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-jb-accent-purple font-bold text-sm">
                        {entry.priority}
                      </span>
                    </div>
                    <div>
                      <p className="text-jb-text-primary font-medium">
                        {entry.genre?.name || `Genre ${entry.genreId}`}
                      </p>
                      <p className="text-jb-text-secondary text-xs">
                        Priority: {entry.priority} &middot; ID: {entry.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveEntry(entry.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-jb-text-secondary hover:text-red-400 transition-colors"
                    title="Remove entry"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Region Modal */}
        <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Region">
          <div className="space-y-4">
            <Input
              label="Region Code"
              placeholder="e.g. BR-SP"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
            />
            <Input
              label="Region Name"
              placeholder="e.g. Sao Paulo"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            {error && <p className="text-jb-highlight-pink text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" fullWidth onClick={() => setEditModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" fullWidth loading={saving} onClick={handleEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>

        {/* Add Catalog Entry Modal */}
        <Modal isOpen={addEntryModal} onClose={() => setAddEntryModal(false)} title="Add Catalog Entry">
          <div className="space-y-4">
            <div>
              <label className="block text-jb-text-secondary text-sm mb-1">Genre</label>
              <select
                value={formGenreId}
                onChange={(e) => setFormGenreId(e.target.value)}
                className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg px-3 py-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green"
              >
                <option value="">Select a genre...</option>
                {genres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Priority"
              type="number"
              placeholder="0"
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value)}
            />
            {error && <p className="text-jb-highlight-pink text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" fullWidth onClick={() => setAddEntryModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" fullWidth loading={saving} onClick={handleAddEntry}>
                Add Entry
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // Regions list view
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-jb-text-primary">Regional Catalogs</h2>
        <Button variant="primary" onClick={openCreate}>
          + New Region
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="72px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : regions.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-jb-text-secondary text-lg mb-2">No regions configured</p>
          <p className="text-jb-text-secondary/60 text-sm mb-4">
            Create a region to start managing regional music catalogs.
          </p>
          <Button variant="primary" onClick={openCreate}>
            + Create First Region
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
          {regions.map((region) => (
            <Card
              key={region.id}
              className="p-5 cursor-pointer hover:border-jb-accent-green/30 transition-all duration-200"
              onClick={() => handleSelectRegion(region)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-jb-accent-green/10 border border-jb-accent-green/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🌎</span>
                  </div>
                  <div>
                    <p className="text-jb-text-primary font-semibold text-lg">{region.name}</p>
                    <p className="text-jb-text-secondary text-sm">
                      Code: <span className="text-jb-accent-green font-mono">{region.code}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-jb-accent-purple font-bold text-lg">{region._count.venues}</p>
                      <p className="text-jb-text-secondary text-[10px] uppercase tracking-wider">Venues</p>
                    </div>
                    <div className="text-center">
                      <p className="text-jb-highlight-pink font-bold text-lg">{region._count.catalogEntries}</p>
                      <p className="text-jb-text-secondary text-[10px] uppercase tracking-wider">Entries</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Region Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create Region">
        <div className="space-y-4">
          <Input
            label="Region Code *"
            placeholder="e.g. BR-SP"
            value={formCode}
            onChange={(e) => setFormCode(e.target.value)}
          />
          <Input
            label="Region Name *"
            placeholder="e.g. Sao Paulo"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          {error && <p className="text-jb-highlight-pink text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" fullWidth loading={saving} onClick={handleCreate}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
