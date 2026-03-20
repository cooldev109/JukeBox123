import React, { useEffect } from 'react';
import { Card, Skeleton } from '@jukebox/ui';
import { useAdminStore } from '../../stores/adminStore';

export const UsersPage: React.FC = () => {
  const { users, isLoading, fetchUsers } = useAdminStore();

  useEffect(() => {
    fetchUsers();
  }, []);

  const roleColor = (role: string) => {
    if (role === 'ADMIN') return 'text-jb-accent-green';
    if (role === 'BAR_OWNER') return 'text-jb-accent-purple';
    if (role === 'EMPLOYEE') return 'text-amber-400';
    if (role === 'AFFILIATE') return 'text-jb-highlight-pink';
    return 'text-jb-text-secondary';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Users</h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height="64px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-jb-text-secondary text-center py-20">
          No users found
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-jb-bg-secondary flex items-center justify-center">
                    <span className="font-bold text-jb-accent-purple">
                      {user.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-jb-text-primary font-medium">
                      {user.name}
                    </p>
                    <p className="text-jb-text-secondary text-xs">
                      {user.email || user.phone || 'No contact info'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold uppercase ${roleColor(user.role)}`}
                >
                  {user.role.replace('_', ' ')}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
