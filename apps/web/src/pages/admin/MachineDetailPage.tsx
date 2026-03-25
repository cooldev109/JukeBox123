import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, StatusIndicator, QueueItemComponent } from '@jukebox/ui';
import type { StatusType } from '@jukebox/ui';
import { api } from '../../lib/api';

interface MachineDetail {
  id: string;
  name: string;
  status: string;
  lastHeartbeat: string | null;
  config: Record<string, unknown>;
  venue?: {
    id: string;
    name: string;
    city: string;
    state: string;
    address?: string | null;
    owner?: { name: string; email: string | null };
  };
}

interface QueueItem {
  id: string;
  position: number;
  status: string;
  isPriority: boolean;
  song: {
    title: string;
    artist: string;
    coverArtUrl: string | null;
    duration: number;
  };
  user: { name: string };
}

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [machineRes, queueRes] = await Promise.all([
        api.get(`/machines/${id}`),
        api
          .get(`/machines/${id}/queue`)
          .catch(() => ({ data: { data: { queue: [] } } })),
      ]);
      setMachine(machineRes.data.data.machine);
      setQueue(queueRes.data.data.queue || []);
    } catch {
      navigate('/admin');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !machine) {
    return (
      <div className="text-center py-20 text-jb-text-secondary">Loading...</div>
    );
  }

  const statusMap = (s: string): StatusType => {
    if (s === 'ONLINE') return 'online';
    if (s === 'ERROR') return 'error';
    return 'offline';
  };

  return (
    <div>
      <button
        onClick={() => navigate('/admin')}
        className="text-jb-text-secondary hover:text-jb-text-primary mb-4 flex items-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Machines
      </button>

      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-jb-text-primary">{machine.name}</h2>
        <StatusIndicator status={statusMap(machine.status)} size="lg" />
      </div>

      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-6">
        {/* Venue Info */}
        <Card className="p-5">
          <h3 className="text-lg font-bold text-jb-text-primary mb-3">
            Venue Info
          </h3>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-jb-text-secondary">Bar:</span>{' '}
              <span className="text-jb-text-primary">{machine.venue?.name || 'N/A'}</span>
            </p>
            <p>
              <span className="text-jb-text-secondary">City:</span>{' '}
              <span className="text-jb-text-primary">
                {machine.venue?.city || 'N/A'}, {machine.venue?.state || ''}
              </span>
            </p>
            {machine.venue?.address && (
              <p>
                <span className="text-jb-text-secondary">Address:</span>{' '}
                <span className="text-jb-text-primary">
                  {machine.venue.address}
                </span>
              </p>
            )}
            <p>
              <span className="text-jb-text-secondary">Owner:</span>{' '}
              <span className="text-jb-text-primary">
                {machine.venue?.owner?.name || 'N/A'}
              </span>
            </p>
            {machine.lastHeartbeat && (
              <p>
                <span className="text-jb-text-secondary">Last Heartbeat:</span>{' '}
                <span className="text-jb-text-primary">
                  {new Date(machine.lastHeartbeat).toLocaleString('pt-BR')}
                </span>
              </p>
            )}
          </div>
        </Card>

        {/* Queue */}
        <Card className="p-5">
          <h3 className="text-lg font-bold text-jb-text-primary mb-3">
            Current Queue ({queue.length})
          </h3>
          {queue.length === 0 ? (
            <p className="text-jb-text-secondary text-sm">Queue is empty</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {queue.map((item, i) => (
                <QueueItemComponent
                  key={item.id}
                  position={i + 1}
                  title={item.song.title}
                  artist={item.song.artist}
                  coverArtUrl={item.song.coverArtUrl}
                  isPriority={item.isPriority}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <Button
          variant="ghost"
          onClick={() =>
            api
              .post(`/machines/${id}/queue/clear`)
              .then(loadData)
              .catch(() => {})
          }
        >
          Clear Queue
        </Button>
      </div>
    </div>
  );
};
