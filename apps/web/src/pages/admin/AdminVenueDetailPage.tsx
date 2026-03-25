import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Skeleton, Button, Input } from '@jukebox/ui';
import { api } from '../../lib/api';

const statusColor = (s: string) => {
  if (s === 'ONLINE' || s === 'ACTIVE') return 'text-jb-accent-green bg-jb-accent-green/10 border-jb-accent-green/30';
  if (s === 'PLAYING') return 'text-jb-accent-purple bg-jb-accent-purple/10 border-jb-accent-purple/30';
  return 'text-red-400 bg-red-400/10 border-red-400/30';
};

type Tab = 'music' | 'revenue' | 'values' | 'settings';

interface VenueAnalytics {
  venue: {
    id: string; code: string; name: string; address: string;
    city: string; state: string; country: string; status: string;
    owner: { id: string; name: string; email: string };
  };
  machines: { id: string; name: string; status: string; lastHeartbeat: string | null; serialNumber: string }[];
  revenue: { today: number; week: number; month: number; allTime: number; todayCount: number };
  queue: { id: string; song: { title: string; artist: string; duration: number }; user: { name: string }; machine: { name: string } }[];
  topSongs: { songId: string; _count: { songId: number } }[];
  commissionSplit: { platform: number; venue: number; affiliate: number; operator: number } | null;
  productPrices: { id: string; price: number; product: { id: string; code: string; name: string; category: string; basePrice: number } }[];
}

export const AdminVenueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('music');
  const [data, setData] = useState<VenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Commission split editing
  const [editSplit, setEditSplit] = useState(false);
  const [splitForm, setSplitForm] = useState({ platform: 30, venue: 30, affiliate: 35, operator: 5 });
  const [splitSaving, setSplitSaving] = useState(false);
  const [splitError, setSplitError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/venues/${id}/analytics`)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load venue'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (data?.commissionSplit) {
      setSplitForm(data.commissionSplit);
    }
  }, [data?.commissionSplit]);

  const handleSaveSplit = async () => {
    const sum = splitForm.platform + splitForm.venue + splitForm.affiliate + splitForm.operator;
    if (sum !== 100) {
      setSplitError(`Split must total 100% (currently ${sum}%)`);
      return;
    }
    setSplitSaving(true);
    setSplitError('');
    try {
      await api.put(`/config/venue/${id}/commission-split`, splitForm);
      setEditSplit(false);
      // Refresh
      const res = await api.get(`/venues/${id}/analytics`);
      setData(res.data.data);
    } catch (err: any) {
      setSplitError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSplitSaving(false);
    }
  };

  const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton height="48px" rounded="lg" className="w-64" />
        <Skeleton height="200px" rounded="lg" className="w-full" />
        <Skeleton height="300px" rounded="lg" className="w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error || 'Venue not found'}</p>
        <Button variant="ghost" onClick={() => navigate('/admin/venues')}>Back to Venues</Button>
      </div>
    );
  }

  const venue = data.venue;
  const machines = data.machines || [];
  const revenue = data.revenue || { today: 0, week: 0, month: 0, allTime: 0, todayCount: 0 };
  const queue = data.queue || [];
  const topSongs = data.topSongs || [];
  const commissionSplit = data.commissionSplit;
  const productPrices = data.productPrices || [];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'music', label: 'Music & Queue' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'values', label: 'Values & Pricing' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/venues')} className="text-jb-text-secondary hover:text-jb-accent-green transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-jb-text-primary">{venue.name}</h2>
          <p className="text-jb-text-secondary text-sm">
            {venue.city}, {venue.state} | Code: <span className="text-jb-accent-green font-mono">{venue.code}</span> | Owner: {venue.owner.name}
          </p>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ml-auto ${statusColor(venue.status)}`}>
          {venue.status}
        </span>
      </div>

      {/* Machines summary */}
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-3 mb-6">
        {machines.map(m => (
          <Card key={m.id} className="p-3 cursor-pointer hover:border-jb-accent-green/30 transition-colors" onClick={() => navigate(`/admin/machines/${m.id}`)}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-jb-text-primary text-sm font-medium truncate">{m.name}</p>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${statusColor(m.status)}`}>
                {m.status}
              </span>
            </div>
            <p className="text-jb-text-secondary text-[10px] font-mono">{m.serialNumber}</p>
          </Card>
        ))}
        {machines.length === 0 && (
          <p className="text-jb-text-secondary text-sm col-span-full text-center py-4">No machines registered</p>
        )}
      </div>

      {/* Quick Access Management Buttons */}
      <div className="grid grid-cols-3 desktop:grid-cols-5 gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/users')}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-jb-bg-secondary/50 border border-white/5 hover:border-jb-accent-purple/40 hover:bg-jb-accent-purple/5 transition-all group"
        >
          <span className="text-2xl">👥</span>
          <span className="text-jb-text-secondary text-xs font-medium group-hover:text-jb-accent-purple transition-colors">Users</span>
        </button>
        <button
          onClick={() => navigate('/admin/songs')}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-jb-bg-secondary/50 border border-white/5 hover:border-jb-accent-green/40 hover:bg-jb-accent-green/5 transition-all group"
        >
          <span className="text-2xl">🎵</span>
          <span className="text-jb-text-secondary text-xs font-medium group-hover:text-jb-accent-green transition-colors">Music Catalog</span>
        </button>
        <button
          onClick={() => navigate('/admin/products')}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-jb-bg-secondary/50 border border-white/5 hover:border-jb-highlight-pink/40 hover:bg-jb-highlight-pink/5 transition-all group"
        >
          <span className="text-2xl">🛍️</span>
          <span className="text-jb-text-secondary text-xs font-medium group-hover:text-jb-highlight-pink transition-colors">Products</span>
        </button>
        <button
          onClick={() => navigate('/admin/regions')}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-jb-bg-secondary/50 border border-white/5 hover:border-amber-400/40 hover:bg-amber-400/5 transition-all group"
        >
          <span className="text-2xl">🌎</span>
          <span className="text-jb-text-secondary text-xs font-medium group-hover:text-amber-400 transition-colors">Regions</span>
        </button>
        <button
          onClick={() => setTab('settings')}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-jb-bg-secondary/50 border border-white/5 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all group"
        >
          <span className="text-2xl">⚙️</span>
          <span className="text-jb-text-secondary text-xs font-medium group-hover:text-cyan-400 transition-colors">Settings</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/10">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'text-jb-accent-green border-jb-accent-green'
                : 'text-jb-text-secondary border-transparent hover:text-jb-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'music' && (
        <div className="space-y-6">
          {/* Active Queue */}
          <div>
            <h3 className="text-lg font-semibold text-jb-text-primary mb-3">Active Queue ({queue.length})</h3>
            {queue.length === 0 ? (
              <p className="text-jb-text-secondary text-sm">Queue is empty</p>
            ) : (
              <div className="space-y-2">
                {queue.map((item, i) => (
                  <Card key={item.id} className="p-3 flex items-center gap-3">
                    <span className="text-jb-accent-purple font-bold text-lg w-8 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-jb-text-primary text-sm font-medium truncate">{item.song.title}</p>
                      <p className="text-jb-text-secondary text-xs truncate">{item.song.artist}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-jb-text-secondary text-xs">{item.user.name}</p>
                      <p className="text-jb-text-secondary text-[10px]">{item.machine.name}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Top Songs */}
          <div>
            <h3 className="text-lg font-semibold text-jb-text-primary mb-3">Top Songs</h3>
            {topSongs.length === 0 ? (
              <p className="text-jb-text-secondary text-sm">No play history yet</p>
            ) : (
              <div className="space-y-1">
                {topSongs.map((s, i) => (
                  <Card key={s.songId} className="p-3 flex items-center gap-3">
                    <span className="text-jb-accent-green font-bold w-6 text-center text-sm">#{i + 1}</span>
                    <p className="text-jb-text-primary text-sm flex-1 truncate font-mono">{s.songId.slice(0, 8)}...</p>
                    <span className="text-jb-accent-purple font-bold text-sm">{s._count.songId} plays</span>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 desktop:grid-cols-4 gap-3">
            <Card glowColor="green" className="p-4 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">Today</p>
              <p className="text-2xl font-bold text-jb-accent-green">{fmt(revenue.today)}</p>
              <p className="text-jb-text-secondary text-[10px]">{revenue.todayCount} txns</p>
            </Card>
            <Card glowColor="purple" className="p-4 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">This Week</p>
              <p className="text-2xl font-bold text-jb-accent-purple">{fmt(revenue.week)}</p>
            </Card>
            <Card glowColor="pink" className="p-4 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">This Month</p>
              <p className="text-2xl font-bold text-jb-highlight-pink">{fmt(revenue.month)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">All Time</p>
              <p className="text-2xl font-bold text-jb-text-primary">{fmt(revenue.allTime)}</p>
            </Card>
          </div>

          {/* Commission Split */}
          {commissionSplit && (
            <Card className="p-4">
              <h3 className="text-jb-text-primary font-semibold mb-3">Revenue Split</h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-jb-accent-green text-xl font-bold">{commissionSplit.platform}%</p>
                  <p className="text-jb-text-secondary text-xs">Platform</p>
                </div>
                <div>
                  <p className="text-jb-accent-purple text-xl font-bold">{commissionSplit.venue}%</p>
                  <p className="text-jb-text-secondary text-xs">Venue</p>
                </div>
                <div>
                  <p className="text-jb-highlight-pink text-xl font-bold">{commissionSplit.affiliate}%</p>
                  <p className="text-jb-text-secondary text-xs">Affiliate</p>
                </div>
                <div>
                  <p className="text-amber-400 text-xl font-bold">{commissionSplit.operator}%</p>
                  <p className="text-jb-text-secondary text-xs">Operator</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'values' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-jb-text-primary">Product Pricing</h3>
          {productPrices.length === 0 ? (
            <p className="text-jb-text-secondary text-sm">No venue-specific price overrides. Using base prices.</p>
          ) : (
            <div className="space-y-2">
              {productPrices.map(pp => (
                <Card key={pp.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-jb-text-primary text-sm font-medium">{pp.product.name}</p>
                    <p className="text-jb-text-secondary text-xs">{pp.product.code} | {pp.product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-jb-accent-green font-bold">{fmt(pp.price)}</p>
                    {pp.price !== pp.product.basePrice && (
                      <p className="text-jb-text-secondary text-xs line-through">{fmt(pp.product.basePrice)}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-6">
          {/* Venue Info */}
          <Card className="p-4">
            <h3 className="text-jb-text-primary font-semibold mb-3">Venue Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-jb-text-secondary">Code:</span> <span className="text-jb-accent-green font-mono ml-1">{venue.code}</span></div>
              <div><span className="text-jb-text-secondary">Status:</span> <span className="text-jb-text-primary ml-1">{venue.status}</span></div>
              <div><span className="text-jb-text-secondary">City:</span> <span className="text-jb-text-primary ml-1">{venue.city}</span></div>
              <div><span className="text-jb-text-secondary">State:</span> <span className="text-jb-text-primary ml-1">{venue.state}</span></div>
              <div className="col-span-2"><span className="text-jb-text-secondary">Address:</span> <span className="text-jb-text-primary ml-1">{venue.address}</span></div>
              <div><span className="text-jb-text-secondary">Owner:</span> <span className="text-jb-text-primary ml-1">{venue.owner.name}</span></div>
              <div><span className="text-jb-text-secondary">Email:</span> <span className="text-jb-text-primary ml-1">{venue.owner.email}</span></div>
            </div>
          </Card>

          {/* Commission Split Settings */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-jb-text-primary font-semibold">Commission Split Override</h3>
              {!editSplit && (
                <Button variant="ghost" size="sm" onClick={() => setEditSplit(true)}>Edit</Button>
              )}
            </div>
            {editSplit ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Platform %" type="number" value={String(splitForm.platform)} onChange={e => setSplitForm(p => ({ ...p, platform: Number(e.target.value) }))} />
                  <Input label="Venue %" type="number" value={String(splitForm.venue)} onChange={e => setSplitForm(p => ({ ...p, venue: Number(e.target.value) }))} />
                  <Input label="Affiliate %" type="number" value={String(splitForm.affiliate)} onChange={e => setSplitForm(p => ({ ...p, affiliate: Number(e.target.value) }))} />
                  <Input label="Operator %" type="number" value={String(splitForm.operator)} onChange={e => setSplitForm(p => ({ ...p, operator: Number(e.target.value) }))} />
                </div>
                <p className="text-jb-text-secondary text-xs">
                  Total: {splitForm.platform + splitForm.venue + splitForm.affiliate + splitForm.operator}% (must be 100%)
                </p>
                {splitError && <p className="text-red-400 text-sm">{splitError}</p>}
                <div className="flex gap-3">
                  <Button variant="ghost" size="sm" onClick={() => { setEditSplit(false); setSplitError(''); }}>Cancel</Button>
                  <Button variant="primary" size="sm" loading={splitSaving} onClick={handleSaveSplit}>Save Split</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-jb-accent-green text-lg font-bold">{commissionSplit?.platform ?? 'Default'}%</p>
                  <p className="text-jb-text-secondary text-xs">Platform</p>
                </div>
                <div>
                  <p className="text-jb-accent-purple text-lg font-bold">{commissionSplit?.venue ?? 'Default'}%</p>
                  <p className="text-jb-text-secondary text-xs">Venue</p>
                </div>
                <div>
                  <p className="text-jb-highlight-pink text-lg font-bold">{commissionSplit?.affiliate ?? 'Default'}%</p>
                  <p className="text-jb-text-secondary text-xs">Affiliate</p>
                </div>
                <div>
                  <p className="text-amber-400 text-lg font-bold">{commissionSplit?.operator ?? 'Default'}%</p>
                  <p className="text-jb-text-secondary text-xs">Operator</p>
                </div>
              </div>
            )}
            {!commissionSplit && !editSplit && (
              <p className="text-jb-text-secondary text-xs mt-2">No venue override — using global default split.</p>
            )}
          </Card>

          {/* Machines */}
          <Card className="p-4">
            <h3 className="text-jb-text-primary font-semibold mb-3">Machines ({machines.length})</h3>
            {machines.length === 0 ? (
              <p className="text-jb-text-secondary text-sm">No machines</p>
            ) : (
              <div className="space-y-2">
                {machines.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-jb-text-primary text-sm">{m.name}</p>
                      <p className="text-jb-text-secondary text-[10px] font-mono">{m.serialNumber}</p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${statusColor(m.status)}`}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
