import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Skeleton, Button, Input, Modal } from '@jukebox/ui';
import { useAdminStore } from '../../stores/adminStore';

const statusColor = (s: string) => {
  if (s === 'ACTIVE') return 'text-jb-accent-green bg-jb-accent-green/10 border-jb-accent-green/30';
  if (s === 'INACTIVE') return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
  return 'text-red-400 bg-red-400/10 border-red-400/30';
};

export const AdminVenuesPage: React.FC = () => {
  const navigate = useNavigate();
  const { venues, users, isLoading, fetchVenues, fetchUsers, updateVenue, reassignVenueOwner, deactivateVenue } = useAdminStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editVenue, setEditVenue] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadVenues = useCallback(() => {
    fetchVenues({ search: search || undefined, status: statusFilter || undefined });
  }, [search, statusFilter, fetchVenues]);

  useEffect(() => { loadVenues(); }, [loadVenues]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const owners = users.filter(u => u.role === 'BAR_OWNER' || u.role === 'ADMIN');

  const handleUpdate = async () => {
    if (!editVenue) return;
    setSaving(true);
    setError('');
    try {
      // If owner changed, use reassign endpoint
      if (formData.ownerId && formData.ownerId !== editVenue.owner?.id) {
        await reassignVenueOwner(editVenue.id, formData.ownerId);
      }
      // Update other fields
      const payload: Record<string, unknown> = {};
      if (formData.name && formData.name !== editVenue.name) payload.name = formData.name;
      if (formData.address && formData.address !== editVenue.address) payload.address = formData.address;
      if (formData.city && formData.city !== editVenue.city) payload.city = formData.city;
      if (formData.state && formData.state !== editVenue.state) payload.state = formData.state;
      if (formData.country && formData.country !== editVenue.country) payload.country = formData.country;
      if (formData.status && formData.status !== editVenue.status) payload.status = formData.status;
      if (Object.keys(payload).length > 0) {
        await updateVenue(editVenue.id, payload);
      }
      setEditVenue(null);
      loadVenues();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update venue');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!window.confirm(`Deactivate venue "${name}"? All machines will go offline.`)) return;
    try {
      await deactivateVenue(id);
      loadVenues();
    } catch (err: any) {
      window.alert(err.response?.data?.error || 'Failed to deactivate venue');
    }
  };

  const openEdit = (venue: any) => {
    setEditVenue(venue);
    setFormData({
      name: venue.name || '',
      address: venue.address || '',
      city: venue.city || '',
      state: venue.state || '',
      country: venue.country || '',
      status: venue.status || '',
      ownerId: venue.owner?.id || '',
    });
    setError('');
  };

  const statusCounts = {
    ACTIVE: venues.filter(v => v.status === 'ACTIVE').length,
    INACTIVE: venues.filter(v => v.status === 'INACTIVE').length,
    SUSPENDED: venues.filter(v => v.status === 'SUSPENDED').length,
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Venues</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-3 mb-6">
        <Card glowColor="purple" className="p-4 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">Total Venues</p>
          <p className="text-3xl font-bold text-jb-accent-purple">{venues.length}</p>
        </Card>
        {(['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`p-4 rounded-xl border text-center transition-all ${
              statusFilter === s ? statusColor(s) + ' ring-1 ring-white/20' : 'bg-jb-bg-secondary/50 border-white/5 hover:border-white/10'
            }`}
          >
            <p className={`text-2xl font-bold ${statusFilter === s ? '' : 'text-jb-text-primary'}`}>{statusCounts[s]}</p>
            <p className="text-[10px] uppercase tracking-wider text-jb-text-secondary">{s}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search by name, city, state, or owner..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Venue list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="88px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <p className="text-jb-text-secondary text-center py-20">No venues found</p>
      ) : (
        <div className="space-y-2">
          {venues.map((venue) => (
            <Card key={venue.id} className="p-4 cursor-pointer hover:border-jb-accent-purple/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0" onClick={() => navigate(`/admin/venues/${venue.id}`)}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-jb-text-primary font-medium truncate">{venue.name}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusColor(venue.status)}`}>
                      {venue.status}
                    </span>
                  </div>
                  <p className="text-jb-text-secondary text-xs truncate">
                    {venue.city}, {venue.state}, {venue.country} | Code: <span className="text-jb-accent-green font-mono">{venue.code}</span>
                  </p>
                  <p className="text-jb-text-secondary text-xs truncate mt-0.5">
                    Owner: {venue.owner?.name || 'N/A'} | Machines: {venue._count?.machines ?? venue.machines?.length ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(venue); }}
                    className="p-2 rounded-lg hover:bg-white/10 text-jb-text-secondary hover:text-jb-accent-green transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {venue.status === 'ACTIVE' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeactivate(venue.id, venue.name); }}
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

      {/* Edit Modal */}
      <Modal isOpen={!!editVenue} onClose={() => setEditVenue(null)} title="Edit Venue">
        <div className="space-y-4">
          <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
          <Input label="Address" value={formData.address || ''} onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={formData.city || ''} onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))} />
            <Input label="State" value={formData.state || ''} onChange={(e) => setFormData(p => ({ ...p, state: e.target.value }))} />
          </div>
          <Input label="Country" value={formData.country || ''} onChange={(e) => setFormData(p => ({ ...p, country: e.target.value }))} />
          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">Status</label>
            <select
              value={formData.status || ''}
              onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
              className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg px-3 py-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">Owner</label>
            <select
              value={formData.ownerId || ''}
              onChange={(e) => setFormData(p => ({ ...p, ownerId: e.target.value }))}
              className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg px-3 py-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green"
            >
              <option value="">Select owner...</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name} ({o.email})</option>
              ))}
            </select>
          </div>
          {error && <p className="text-jb-highlight-pink text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setEditVenue(null)}>Cancel</Button>
            <Button variant="primary" fullWidth loading={saving} onClick={handleUpdate}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
