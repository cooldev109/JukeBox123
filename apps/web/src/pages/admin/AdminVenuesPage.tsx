import React, { useEffect } from 'react';
import { Card, Skeleton } from '@jukebox/ui';
import { useAdminStore } from '../../stores/adminStore';

export const AdminVenuesPage: React.FC = () => {
  const { venues, isLoading, fetchVenues } = useAdminStore();

  useEffect(() => {
    fetchVenues();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Venues</h2>

      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-4 mb-8">
        <Card glowColor="purple" className="p-4 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">Total Venues</p>
          <p className="text-3xl font-bold text-jb-accent-purple">{venues.length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">Total Machines</p>
          <p className="text-3xl font-bold text-jb-text-primary">
            {venues.reduce((sum, v) => sum + (v.machines?.length || 0), 0)}
          </p>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="80px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <p className="text-jb-text-secondary text-center py-20">No venues found</p>
      ) : (
        <div className="space-y-2">
          {venues.map((venue) => (
            <Card key={venue.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-jb-text-primary font-medium">{venue.name}</p>
                  <p className="text-jb-text-secondary text-xs">
                    {venue.city}, {venue.state} — Owner: {venue.owner?.name || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-jb-accent-purple font-bold">{venue.machines?.length || 0}</p>
                  <p className="text-jb-text-secondary text-xs">machines</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
