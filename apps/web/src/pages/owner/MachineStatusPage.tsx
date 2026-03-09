import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, StatusIndicator, QueueItemComponent, MusicVisualizer } from '@jukebox/ui';
import { useBarOwnerStore } from '../../stores/barOwnerStore';

type StatusType = 'online' | 'error' | 'offline';

const statusMap = (s: string): StatusType => {
  if (s === 'ONLINE') return 'online';
  if (s === 'ERROR') return 'error';
  return 'offline';
};

export const MachineStatusPage: React.FC = () => {
  const { venue, machine, queue, isLoading, fetchVenue, fetchMachine, fetchQueue } = useBarOwnerStore();

  useEffect(() => {
    fetchVenue();
    fetchMachine();
  }, []);

  useEffect(() => {
    if (machine) fetchQueue();
  }, [machine]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Machine Status</h2>

      {!machine ? (
        <div className="text-center py-20">
          <p className="text-jb-text-secondary">No machine registered for your venue</p>
        </div>
      ) : (
        <>
          {/* Status Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card glowColor={machine.status === 'ONLINE' ? 'green' : 'pink'} className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-jb-text-primary">{machine.name}</h3>
                  <p className="text-jb-text-secondary text-sm">{venue?.name}</p>
                </div>
                <StatusIndicator status={statusMap(machine.status)} size="lg" />
              </div>

              {machine.status === 'ONLINE' && (
                <div className="flex items-center gap-3">
                  <MusicVisualizer isPlaying size="sm" barCount={5} />
                  <span className="text-jb-accent-green text-sm">Machine is active</span>
                </div>
              )}

              {machine.lastHeartbeat && (
                <p className="text-jb-text-secondary/60 text-xs mt-3">
                  Last heartbeat: {new Date(machine.lastHeartbeat).toLocaleString('pt-BR')}
                </p>
              )}
            </Card>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="p-4 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">Queue Size</p>
              <p className="text-3xl font-bold text-jb-accent-purple">{queue.length}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-jb-text-secondary text-xs mb-1">Status</p>
              <p className={`text-lg font-bold ${machine.status === 'ONLINE' ? 'text-jb-accent-green' : 'text-jb-highlight-pink'}`}>
                {machine.status}
              </p>
            </Card>
          </div>

          {/* Current Queue */}
          <Card className="p-5">
            <h3 className="text-lg font-bold text-jb-text-primary mb-3">Current Queue</h3>
            {queue.length === 0 ? (
              <p className="text-jb-text-secondary text-sm py-4">Queue is empty</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {queue.map((item, i) => (
                  <QueueItemComponent
                    key={item.id}
                    position={i + 1}
                    title={item.song.title}
                    artist={item.song.artist}
                    coverArtUrl={item.song.coverArtUrl}
                    isPriority={item.isPriority}
                    isPlaying={i === 0 && item.status === 'PLAYING'}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
