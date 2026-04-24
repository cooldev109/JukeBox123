import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { Card, Skeleton, Button, Input, Modal } from '@jukebox/ui';
import { api } from '../../lib/api';
import { EventConfigEditor } from '../../components/EventConfigEditor';

const statusColor = (s: string) => {
  if (s === 'ONLINE' || s === 'ACTIVE') return 'text-jb-accent-green bg-jb-accent-green/10 border-jb-accent-green/30';
  if (s === 'PLAYING') return 'text-jb-accent-purple bg-jb-accent-purple/10 border-jb-accent-purple/30';
  return 'text-red-400 bg-red-400/10 border-red-400/30';
};

type Tab = 'music' | 'revenue' | 'users' | 'products' | 'regions' | 'settings';

interface VenueAnalytics {
  venue: {
    id: string; code: string; name: string; address: string;
    city: string; state: string; country: string; status: string;
    owner: { id: string; name: string; email: string };
    regionId?: string | null;
    pixKey?: string | null;
    pixKeyType?: string | null;
  };
  machines: { id: string; name: string; status: string; lastHeartbeat: string | null; serialNumber: string }[];
  revenue: { today: number; week: number; month: number; allTime: number; todayCount: number };
  queue: { id: string; song: { title: string; artist: string; duration: number }; user: { name: string }; machine: { name: string } }[];
  topSongs: { songId: string; _count: { songId: number } }[];
  commissionSplit: { platform: number; venue: number; affiliate: number; operator: number } | null;
  productPrices: { id: string; price: number; product: { id: string; code: string; name: string; category: string; basePrice: number } }[];
}

interface VenueUser {
  id: string; name: string; email?: string; phone?: string; role: string;
  createdAt: string; _count?: { queueItems: number; transactions: number };
}

interface VenueProduct {
  id: string; code: string; name: string; category: string; basePrice: number;
  venuePrice?: number;
}

interface VenueRegion {
  id: string; code: string; name: string;
  _count: { venues: number; catalogEntries: number };
}

export const AdminVenueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('music');
  const [data, setData] = useState<VenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Commission split editing
  const [editSplit, setEditSplit] = useState(false);
  const [splitForm, setSplitForm] = useState({ platform: 30, venue: 30, affiliate: 35, operator: 5 });
  const [splitSaving, setSplitSaving] = useState(false);
  const [splitError, setSplitError] = useState('');

  // Pix key editing
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('CPF');
  const [pixSaving, setPixSaving] = useState(false);
  const [pixSaved, setPixSaved] = useState(false);
  const [pixError, setPixError] = useState('');

  // Venue-specific data
  const [venueUsers, setVenueUsers] = useState<VenueUser[]>([]);
  const [venueUsersLoading, setVenueUsersLoading] = useState(false);
  const [venueProducts, setVenueProducts] = useState<VenueProduct[]>([]);
  const [venueProductsLoading, setVenueProductsLoading] = useState(false);
  const [venueRegion, setVenueRegion] = useState<VenueRegion | null>(null);
  const [allRegions, setAllRegions] = useState<VenueRegion[]>([]);
  const [regionLoading, setRegionLoading] = useState(false);

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
    if (data?.venue) {
      setPixKey(data.venue.pixKey || '');
      setPixKeyType(data.venue.pixKeyType || 'CPF');
    }
  }, [data?.commissionSplit, data?.venue]);

  // Load venue-specific users when Users tab opens
  useEffect(() => {
    if (tab === 'users' && id && venueUsers.length === 0) {
      setVenueUsersLoading(true);
      api.get(`/venues/${id}/users`)
        .then(res => setVenueUsers(res.data.data?.users || []))
        .catch(() => setVenueUsers([]))
        .finally(() => setVenueUsersLoading(false));
    }
  }, [tab, id]);

  // Load venue-specific products when Products tab opens
  useEffect(() => {
    if (tab === 'products' && id && venueProducts.length === 0) {
      setVenueProductsLoading(true);
      api.get(`/products/venue/${id}`)
        .then(res => {
          const products = res.data.data?.products || [];
          setVenueProducts(products);
        })
        .catch(() => setVenueProducts([]))
        .finally(() => setVenueProductsLoading(false));
    }
  }, [tab, id]);

  // Load region when Regions tab opens
  useEffect(() => {
    if (tab === 'regions' && id) {
      setRegionLoading(true);
      // Load all regions
      api.get('/regions')
        .then(res => {
          const regions = res.data.data?.regions || [];
          setAllRegions(regions);
          // Find current venue's region
          const venueRegionId = data?.venue?.regionId;
          if (venueRegionId) {
            const found = regions.find((r: VenueRegion) => r.id === venueRegionId);
            setVenueRegion(found || null);
          }
        })
        .catch(() => {})
        .finally(() => setRegionLoading(false));
    }
  }, [tab, id, data?.venue?.regionId]);

  // Load venue-specific users when Users tab opens
  useEffect(() => {
    if (tab === 'users' && id && venueUsers.length === 0) {
      setVenueUsersLoading(true);
      api.get(`/venues/${id}/users`)
        .then(res => setVenueUsers(res.data.data?.users || []))
        .catch(() => setVenueUsers([]))
        .finally(() => setVenueUsersLoading(false));
    }
  }, [tab, id]);

  // Load venue-specific products when Products tab opens
  useEffect(() => {
    if (tab === 'products' && id && venueProducts.length === 0) {
      setVenueProductsLoading(true);
      api.get(`/products/venue/${id}`)
        .then(res => {
          const products = res.data.data?.products || [];
          setVenueProducts(products);
        })
        .catch(() => setVenueProducts([]))
        .finally(() => setVenueProductsLoading(false));
    }
  }, [tab, id]);

  // Load region when Regions tab opens
  useEffect(() => {
    if (tab === 'regions' && id) {
      setRegionLoading(true);
      // Load all regions
      api.get('/regions')
        .then(res => {
          const regions = res.data.data?.regions || [];
          setAllRegions(regions);
          // Find current venue's region
          const venueRegionId = data?.venue?.regionId;
          if (venueRegionId) {
            const found = regions.find((r: VenueRegion) => r.id === venueRegionId);
            setVenueRegion(found || null);
          }
        })
        .catch(() => {})
        .finally(() => setRegionLoading(false));
    }
  }, [tab, id, data?.venue?.regionId]);

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
      const res = await api.get(`/venues/${id}/analytics`);
      setData(res.data.data);
    } catch (err: any) {
      setSplitError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSplitSaving(false);
    }
  };

  const handleSavePixKey = async () => {
    if (!id) return;
    if (!pixKey.trim()) { setPixError('Enter a Pix key'); return; }
    setPixSaving(true);
    setPixError('');
    try {
      await api.put('/payments/pix/venue-key', { venueId: id, pixKey: pixKey.trim(), pixKeyType });
      setPixSaved(true);
      setTimeout(() => setPixSaved(false), 2000);
    } catch (err: any) {
      setPixError(err.response?.data?.error || 'Failed to save Pix key');
    } finally {
      setPixSaving(false);
    }
  };

  const handleAssignRegion = async (regionId: string) => {
    if (!id) return;
    try {
      await api.put(`/venues/${id}`, { regionId: regionId || null });
      // Refresh
      const res = await api.get(`/venues/${id}/analytics`);
      setData(res.data.data);
      const found = allRegions.find(r => r.id === regionId);
      setVenueRegion(found || null);
    } catch {
      // ignore
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

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'music', label: 'Music & Queue', icon: '🎵' },
    { key: 'revenue', label: 'Revenue', icon: '💰' },
    { key: 'users', label: 'Users', icon: '👥' },
    { key: 'products', label: 'Products', icon: '🛍️' },
    { key: 'regions', label: 'Regions', icon: '🌎' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
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
        <Button variant="secondary" size="sm" onClick={() => setShowQR(true)}>
          QR Code
        </Button>
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

      {/* Tabs with icons */}
      <div className="flex gap-1 mb-6 border-b border-white/10 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t.key
                ? 'text-jb-accent-green border-jb-accent-green'
                : 'text-jb-text-secondary border-transparent hover:text-jb-text-primary'
            }`}
          >
            <span className="text-base">{t.icon}</span>
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

      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-jb-text-primary">Venue Users</h3>
            <p className="text-jb-text-secondary text-sm">{venueUsers.length} users</p>
          </div>

          {/* Owner card */}
          <Card glowColor="green" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-jb-accent-green/10 border border-jb-accent-green/30 flex items-center justify-center flex-shrink-0">
                <span className="text-jb-accent-green font-bold text-sm">O</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-jb-text-primary font-medium">{venue.owner.name}</p>
                <p className="text-jb-text-secondary text-xs">{venue.owner.email}</p>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border text-jb-accent-green bg-jb-accent-green/10 border-jb-accent-green/30">
                OWNER
              </span>
            </div>
          </Card>

          {/* Venue users (customers who transacted) */}
          {venueUsersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height="56px" rounded="lg" className="w-full" />
              ))}
            </div>
          ) : venueUsers.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-jb-text-secondary">No customer activity at this venue yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {venueUsers.map(u => (
                <Card key={u.id} className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-jb-accent-purple/10 border border-jb-accent-purple/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-jb-accent-purple font-bold text-xs">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-jb-text-primary text-sm font-medium truncate">{u.name}</p>
                    <p className="text-jb-text-secondary text-xs truncate">{u.email || u.phone || 'No contact'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                      u.role === 'CUSTOMER' ? 'text-jb-accent-purple bg-jb-accent-purple/10 border-jb-accent-purple/30'
                      : u.role === 'AFFILIATE' ? 'text-jb-highlight-pink bg-jb-highlight-pink/10 border-jb-highlight-pink/30'
                      : 'text-jb-text-secondary bg-white/5 border-white/10'
                    }`}>
                      {u.role}
                    </span>
                    {u._count && (
                      <p className="text-jb-text-secondary text-[10px] mt-1">
                        {u._count.transactions} txns | {u._count.queueItems} songs
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-jb-text-primary">Venue Products & Pricing</h3>
          </div>
          <p className="text-jb-text-secondary text-sm">
            Products available at <span className="text-jb-accent-green">{venue.name}</span>. Venue prices override base prices.
          </p>

          {venueProductsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height="56px" rounded="lg" className="w-full" />
              ))}
            </div>
          ) : venueProducts.length === 0 ? (
            <div className="space-y-4">
              <Card className="p-8 text-center">
                <p className="text-jb-text-secondary mb-2">No products loaded yet</p>
                <p className="text-jb-text-secondary/60 text-sm">Configure products in the global Products page first.</p>
              </Card>
              {/* Fallback: show analytics product prices */}
              {productPrices.length > 0 && (
                <>
                  <h4 className="text-jb-text-primary font-medium">Price Overrides</h4>
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
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {['MUSIC', 'SPECIAL_EVENT', 'COMBO'].map(cat => {
                const catProducts = venueProducts.filter(p => p.category === cat);
                if (catProducts.length === 0) return null;
                return (
                  <div key={cat}>
                    <h4 className="text-jb-text-secondary text-xs uppercase tracking-wider font-bold mb-2 mt-4">
                      {cat === 'MUSIC' ? 'Music' : cat === 'SPECIAL_EVENT' ? 'Special Events' : 'Combos'}
                    </h4>
                    {catProducts.map(p => (
                      <Card key={p.id} className="p-3 flex items-center justify-between mb-2">
                        <div>
                          <p className="text-jb-text-primary text-sm font-medium">{p.name}</p>
                          <p className="text-jb-text-secondary text-xs">{p.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-jb-accent-green font-bold">{fmt(p.venuePrice ?? p.basePrice)}</p>
                          {p.venuePrice != null && p.venuePrice !== p.basePrice && (
                            <p className="text-jb-text-secondary text-xs line-through">{fmt(p.basePrice)}</p>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'regions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-jb-text-primary">Venue Region</h3>
          </div>
          <p className="text-jb-text-secondary text-sm">
            The region determines which music catalog is available at this venue.
          </p>

          {regionLoading ? (
            <Skeleton height="100px" rounded="lg" className="w-full" />
          ) : (
            <>
              {/* Current region */}
              {venueRegion ? (
                <Card glowColor="green" className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-jb-accent-green/10 border border-jb-accent-green/30 flex items-center justify-center">
                        <span className="text-xl">🌎</span>
                      </div>
                      <div>
                        <p className="text-jb-text-primary font-semibold text-lg">{venueRegion.name}</p>
                        <p className="text-jb-text-secondary text-sm">
                          Code: <span className="text-jb-accent-green font-mono">{venueRegion.code}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-jb-accent-purple font-bold">{venueRegion._count?.venues || 0} venues</p>
                      <p className="text-jb-text-secondary text-xs">{venueRegion._count?.catalogEntries || 0} catalog entries</p>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-6 text-center">
                  <p className="text-jb-text-secondary mb-2">No region assigned</p>
                  <p className="text-jb-text-secondary/60 text-sm">Assign a region to control which music catalog is available.</p>
                </Card>
              )}

              {/* Change region selector */}
              <Card className="p-4">
                <h4 className="text-jb-text-primary font-medium mb-3">
                  {venueRegion ? 'Change Region' : 'Assign Region'}
                </h4>
                <div className="flex gap-2 flex-wrap">
                  {allRegions.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleAssignRegion(r.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        venueRegion?.id === r.id
                          ? 'bg-jb-accent-green text-jb-bg-primary'
                          : 'bg-jb-bg-secondary border border-white/10 text-jb-text-secondary hover:border-jb-accent-green/40 hover:text-jb-text-primary'
                      }`}
                    >
                      {r.name} ({r.code})
                    </button>
                  ))}
                  {venueRegion && (
                    <button
                      onClick={() => handleAssignRegion('')}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-jb-bg-secondary border border-white/10 text-red-400 hover:border-red-400/40"
                    >
                      Remove Region
                    </button>
                  )}
                </div>
              </Card>
            </>
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

          {/* Pix Key Management */}
          <Card className="p-4">
            <h3 className="text-jb-text-primary font-semibold mb-3">Pix Key</h3>
            <p className="text-jb-text-secondary text-xs mb-3">
              Set the venue&apos;s Pix key for receiving payments.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-jb-text-secondary text-xs mb-1">Key Type</label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg text-jb-text-primary px-3 py-2 text-sm focus:outline-none focus:border-jb-accent-purple"
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone</option>
                  <option value="EVP">Random Key (EVP)</option>
                </select>
              </div>
              <Input
                label="Pix Key"
                value={pixKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPixKey(e.target.value)}
                placeholder={pixKeyType === 'EMAIL' ? 'email@example.com' : pixKeyType === 'PHONE' ? '+5511...' : ''}
              />
              {pixError && <p className="text-red-400 text-xs">{pixError}</p>}
              <Button variant="primary" size="sm" fullWidth loading={pixSaving} onClick={handleSavePixKey}>
                {pixSaved ? 'Saved!' : 'Save Pix Key'}
              </Button>
            </div>
          </Card>

          {/* Special Events Configuration */}
          <Card className="p-4">
            <h3 className="text-jb-text-primary font-semibold mb-3">Special Events Pricing & Duration</h3>
            <EventConfigEditor venueId={id} />
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

      {/* QR Code Modal */}
      <Modal isOpen={showQR} onClose={() => setShowQR(false)} title={`QR Code - ${venue.name}`}>
        <div className="space-y-4 text-center">
          <p className="text-jb-text-secondary text-sm">
            Customers scan this code to open the jukebox for this venue.
          </p>
          <div ref={qrRef} className="bg-white p-4 rounded-xl inline-block">
            <QRCodeCanvas
              value={`${window.location.origin}/browse?venue=${encodeURIComponent(venue.code)}`}
              size={260}
              level="H"
              marginSize={2}
            />
          </div>
          <p className="text-jb-accent-green font-mono font-bold text-lg">{venue.code}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                const canvas = qrRef.current?.querySelector('canvas');
                if (!canvas) return;
                const link = document.createElement('a');
                link.download = `jukebox-qr-${venue.code}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
              }}
            >
              Download PNG
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                const canvas = qrRef.current?.querySelector('canvas');
                if (!canvas) return;
                const dataUrl = canvas.toDataURL('image/png');
                const w = window.open('', '_blank');
                if (!w) return;
                w.document.write(
                  `<html><head><title>JukeBox QR - ${venue.name}</title></head>` +
                  `<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;">` +
                  `<h1 style="margin-bottom:4px;">JukeBox</h1>` +
                  `<h2 style="margin-top:0;color:#555;">${venue.name}</h2>` +
                  `<img src="${dataUrl}" style="width:400px;height:400px;" />` +
                  `<p style="font-size:24px;font-weight:bold;margin-top:20px;">Code: ${venue.code}</p>` +
                  `<p style="color:#666;">Scan this QR code to play music!</p>` +
                  `</body></html>`
                );
                w.document.close();
                w.onload = () => { w.print(); w.close(); };
              }}
            >
              Print
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
