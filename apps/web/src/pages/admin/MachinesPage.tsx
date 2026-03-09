import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, StatusIndicator, Skeleton } from '@jukebox/ui';
import type { StatusType } from '@jukebox/ui';
import { useAdminStore } from '../../stores/adminStore';

export const MachinesPage: React.FC = () => {
  const navigate = useNavigate();
  const { machines, isLoading, fetchMachines } = useAdminStore();

  useEffect(() => {
    fetchMachines();
  }, []);

  const onlineCount = machines.filter((m) => m.status === 'ONLINE').length;
  const errorCount = machines.filter((m) => m.status === 'ERROR').length;
  const offlineCount = machines.filter(
    (m) => m.status === 'OFFLINE' || m.status === 'MAINTENANCE',
  ).length;

  // Group by city
  const grouped = machines.reduce<Record<string, typeof machines>>((acc, m) => {
    const city = m.venue?.city || 'Unknown';
    if (!acc[city]) acc[city] = [];
    acc[city].push(m);
    return acc;
  }, {});

  const statusMap = (s: string): StatusType => {
    if (s === 'ONLINE') return 'online';
    if (s === 'ERROR') return 'error';
    return 'offline';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">
        Machine Overview
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-4 mb-8">
        <Card glowColor="green" className="p-4 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">Total</p>
          <p className="text-3xl font-bold text-jb-text-primary">
            {machines.length}
          </p>
        </Card>
        <Card glowColor="green" className="p-4 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">Online</p>
          <p className="text-3xl font-bold text-jb-accent-green">{onlineCount}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">Errors</p>
          <p className="text-3xl font-bold text-jb-highlight-pink">{errorCount}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-jb-text-secondary text-xs mb-1">Offline</p>
          <p className="text-3xl font-bold text-jb-text-secondary">
            {offlineCount}
          </p>
        </Card>
      </div>

      {/* Machines by City */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="80px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-20">
          <p className="text-jb-text-secondary">No machines registered</p>
        </div>
      ) : (
        Object.entries(grouped).map(([city, cityMachines]) => (
          <div key={city} className="mb-6">
            <h3 className="text-lg font-semibold text-jb-text-primary mb-3">
              {city}
            </h3>
            <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
              {cityMachines.map((machine) => (
                <motion.div
                  key={machine.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Card
                    className="p-4 cursor-pointer"
                    glowColor={
                      machine.status === 'ONLINE'
                        ? 'green'
                        : machine.status === 'ERROR'
                          ? 'pink'
                          : 'purple'
                    }
                    onClick={() => navigate(`/admin/machines/${machine.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-jb-text-primary">
                          {machine.name}
                        </h4>
                        <p className="text-jb-text-secondary text-sm">
                          {machine.venue?.name}
                        </p>
                      </div>
                      <StatusIndicator
                        status={statusMap(machine.status)}
                        size="md"
                      />
                    </div>
                    {machine.lastHeartbeat && (
                      <p className="text-jb-text-secondary/60 text-xs mt-2">
                        Last seen:{' '}
                        {new Date(machine.lastHeartbeat).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
