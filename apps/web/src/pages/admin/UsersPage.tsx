import React, { useEffect, useState, useCallback } from 'react';
import { Card, Skeleton, Button, Input, Modal } from '@jukebox/ui';
import { useAdminStore } from '../../stores/adminStore';

const ROLES = ['ADMIN', 'BAR_OWNER', 'CUSTOMER', 'EMPLOYEE', 'AFFILIATE'] as const;

const roleColor = (role: string) => {
  if (role === 'ADMIN') return 'text-jb-accent-green';
  if (role === 'BAR_OWNER') return 'text-jb-accent-purple';
  if (role === 'EMPLOYEE') return 'text-amber-400';
  if (role === 'AFFILIATE') return 'text-jb-highlight-pink';
  return 'text-jb-text-secondary';
};

const roleBg = (role: string) => {
  if (role === 'ADMIN') return 'bg-jb-accent-green/10 border-jb-accent-green/30';
  if (role === 'BAR_OWNER') return 'bg-jb-accent-purple/10 border-jb-accent-purple/30';
  if (role === 'EMPLOYEE') return 'bg-amber-400/10 border-amber-400/30';
  if (role === 'AFFILIATE') return 'bg-jb-highlight-pink/10 border-jb-highlight-pink/30';
  return 'bg-white/5 border-white/10';
};

export const UsersPage: React.FC = () => {
  const { users, isLoading, fetchUsers, createUser, updateUser, deactivateUser } = useAdminStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editUser, setEditUser] = useState<Record<string, unknown> | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(() => {
    fetchUsers({ search: search || undefined, role: roleFilter || undefined, includeInactive: showInactive || undefined });
  }, [search, roleFilter, showInactive, fetchUsers]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await createUser({
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        password: formData.password || undefined,
        role: formData.role || 'CUSTOMER',
        regionAccess: formData.regionAccess || undefined,
        referralCode: formData.referralCode || undefined,
      });
      setCreateModal(false);
      setFormData({});
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {};
      if (formData.name) payload.name = formData.name;
      if (formData.email) payload.email = formData.email;
      if (formData.phone) payload.phone = formData.phone;
      if (formData.role) payload.role = formData.role;
      if (formData.password) payload.password = formData.password;
      if (formData.regionAccess !== undefined) payload.regionAccess = formData.regionAccess || null;
      if (formData.referralCode !== undefined) payload.referralCode = formData.referralCode || null;
      await updateUser(editUser.id as string, payload);
      setEditUser(null);
      setFormData({});
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!window.confirm(`Deactivate user "${name}"? They will no longer be able to log in.`)) return;
    try {
      await deactivateUser(id);
      loadUsers();
    } catch (err: any) {
      window.alert(err.response?.data?.error || 'Failed to deactivate user');
    }
  };

  const openEdit = (user: any) => {
    setEditUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || '',
      regionAccess: user.regionAccess || '',
      referralCode: user.referralCode || '',
      password: '',
    });
    setError('');
  };

  const openCreate = () => {
    setCreateModal(true);
    setFormData({ role: 'CUSTOMER', password: 'password123' });
    setError('');
  };

  const roleCounts = ROLES.map(r => ({ role: r, count: users.filter(u => u.role === r).length }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-jb-text-primary">Users</h2>
        <Button variant="primary" onClick={openCreate}>+ Create User</Button>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 desktop:grid-cols-5 gap-3 mb-6">
        {roleCounts.map(({ role, count }) => (
          <button
            key={role}
            onClick={() => setRoleFilter(roleFilter === role ? '' : role)}
            className={`p-3 rounded-xl border text-center transition-all ${
              roleFilter === role ? roleBg(role) + ' ring-1 ring-white/20' : 'bg-jb-bg-secondary/50 border-white/5 hover:border-white/10'
            }`}
          >
            <p className={`text-2xl font-bold ${roleColor(role)}`}>{count}</p>
            <p className="text-jb-text-secondary text-[10px] uppercase tracking-wider">{role.replace('_', ' ')}</p>
          </button>
        ))}
      </div>

      {/* Search and filters */}
      <div className="flex flex-col desktop:flex-row gap-3 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-jb-text-secondary text-sm cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-jb-accent-green" />
          Show inactive
        </label>
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height="72px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-jb-text-secondary text-center py-20">No users found</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Card key={user.id} className={`p-4 ${user.isActive === false ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-jb-bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className={`font-bold ${roleColor(user.role)}`}>
                      {user.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-jb-text-primary font-medium truncate">{user.name}</p>
                    <p className="text-jb-text-secondary text-xs truncate">
                      {user.email || user.phone || 'No contact'}
                      {user.regionAccess && ` | Region: ${user.regionAccess}`}
                      {user.referralCode && ` | Code: ${user.referralCode}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${roleBg(user.role)} ${roleColor(user.role)}`}>
                    {user.role.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => openEdit(user)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-jb-text-secondary hover:text-jb-accent-green transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {user.isActive !== false && (
                    <button
                      onClick={() => handleDeactivate(user.id, user.name)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-jb-text-secondary hover:text-red-400 transition-colors"
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
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create User">
        <div className="space-y-4">
          <Input label="Name *" value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
          <Input label="Email" type="email" value={formData.email || ''} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} />
          <Input label="Phone" value={formData.phone || ''} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} />
          <Input label="Password" value={formData.password || ''} onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} />
          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">Role</label>
            <select
              value={formData.role || 'CUSTOMER'}
              onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
              className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg px-3 py-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green"
            >
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          {formData.role === 'EMPLOYEE' && (
            <Input label="Region Access" placeholder="e.g. SP, RJ" value={formData.regionAccess || ''} onChange={(e) => setFormData(p => ({ ...p, regionAccess: e.target.value }))} />
          )}
          {formData.role === 'AFFILIATE' && (
            <Input label="Referral Code" placeholder="Auto-generated if empty" value={formData.referralCode || ''} onChange={(e) => setFormData(p => ({ ...p, referralCode: e.target.value }))} />
          )}
          {error && <p className="text-jb-highlight-pink text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button variant="primary" fullWidth loading={saving} onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        <div className="space-y-4">
          <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
          <Input label="Email" type="email" value={formData.email || ''} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} />
          <Input label="Phone" value={formData.phone || ''} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} />
          <Input label="New Password" placeholder="Leave empty to keep current" value={formData.password || ''} onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} />
          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">Role</label>
            <select
              value={formData.role || ''}
              onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
              className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg px-3 py-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green"
            >
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          {formData.role === 'EMPLOYEE' && (
            <Input label="Region Access" placeholder="e.g. SP, RJ" value={formData.regionAccess || ''} onChange={(e) => setFormData(p => ({ ...p, regionAccess: e.target.value }))} />
          )}
          {formData.role === 'AFFILIATE' && (
            <Input label="Referral Code" value={formData.referralCode || ''} onChange={(e) => setFormData(p => ({ ...p, referralCode: e.target.value }))} />
          )}
          {error && <p className="text-jb-highlight-pink text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setEditUser(null)}>Cancel</Button>
            <Button variant="primary" fullWidth loading={saving} onClick={handleUpdate}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
