import React, { useEffect } from 'react';
import { Card, Skeleton } from '@jukebox/ui';
import { useEmployeeStore } from '../../stores/employeeStore';

export const EmployeeVenuesPage: React.FC = () => {
  const { venues, isLoading, fetchVenues } = useEmployeeStore();

  useEffect(() => {
    fetchVenues();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Venues</h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="80px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-jb-text-secondary">No venues in your region</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
          {venues.map((venue) => (
            <Card key={venue.id} className="p-4" glowColor="purple">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-jb-text-primary truncate">
                    {venue.name}
                  </h4>
                  <p className="text-jb-text-secondary text-sm">
                    {venue.city}, {venue.state}
                  </p>
                </div>
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-jb-accent-purple/20 text-jb-accent-purple border border-jb-accent-purple/30">
                  {venue.code}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                <p className="text-jb-text-secondary text-xs">
                  Owner: <span className="text-jb-text-primary">{venue.owner?.name || 'N/A'}</span>
                </p>
                <p className="text-jb-text-secondary text-xs">
                  Machines:{' '}
                  <span className="text-jb-accent-green font-semibold">
                    {venue._count?.machines ?? 0}
                  </span>
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
