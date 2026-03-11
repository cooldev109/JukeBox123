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

const getTvPlayerUrl = (machineId: string) => {
  const base = window.location.origin;
  return `${base}/tv-player?machine=${machineId}`;
};

export const MachineStatusPage: React.FC = () => {
  const { venue, machine, machines, queue, fetchVenue, fetchMachine, fetchQueue, selectMachine } = useBarOwnerStore();

  useEffect(() => {
    fetchVenue();
    fetchMachine();
  }, []);

  useEffect(() => {
    if (machine) fetchQueue();
  }, [machine]);

  const copyTvPlayerUrl = (machineId: string) => {
    navigator.clipboard.writeText(getTvPlayerUrl(machineId));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Machine Status</h2>

      {machines.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-jb-text-secondary">No machine registered for your venue</p>
        </div>
      ) : (
        <>
          {/* Machine Selector */}
          {machines.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {machines.map((m) => (
                <motion.button
                  key={m.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectMachine(m.id)}
                  className={`p-4 rounded-xl border text-left transition-colors ${
                    machine?.id === m.id
                      ? 'border-jb-accent-green bg-jb-accent-green/10'
                      : 'border-jb-dark-card bg-jb-dark-card hover:border-jb-accent-purple/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-jb-text-primary">{m.name}</p>
                      <p className="text-xs text-jb-text-secondary mt-1">{m.status}</p>
                    </div>
                    <StatusIndicator status={statusMap(m.status)} size="sm" />
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {machine && (
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

                  {/* TV Player Link */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-jb-text-secondary text-xs mb-2">TV Player</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={getTvPlayerUrl(machine.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-jb-accent-purple/20 text-jb-accent-purple hover:bg-jb-accent-purple/30 transition-colors text-sm font-medium"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v6h8V6z" clipRule="evenodd" />
                          <path d="M7 16a1 1 0 100 2h6a1 1 0 100-2H7z" />
                        </svg>
                        Open TV Player
                      </a>
                      <button
                        onClick={() => copyTvPlayerUrl(machine.id)}
                        className="px-3 py-2 rounded-lg bg-jb-dark-card text-jb-text-secondary hover:text-jb-text-primary hover:bg-jb-dark-card/80 transition-colors text-sm"
                        title="Copy TV Player URL"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                        </svg>
                      </button>
                    </div>
                  </div>
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
        </>
      )}
    </div>
  );
};
