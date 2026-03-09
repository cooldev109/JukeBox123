import React, { useEffect, useState } from 'react';
import { SongCard, Skeleton } from '@jukebox/ui';
import { api } from '../lib/api';
import { useQueueStore } from '../stores/queueStore';

interface HistoryItem {
  id: string;
  song: {
    id: string;
    title: string;
    artist: string;
    coverArtUrl: string | null;
    duration: number;
    genre: string;
  };
  playedAt: string;
  venueName: string;
}

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToQueue, machineId } = useQueueStore();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/songs/history');
      setHistory(data.data.history || []);
    } catch {
      // History endpoint may not be available yet
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequeue = async (songId: string) => {
    if (!machineId) return;
    try {
      await addToQueue(machineId, songId);
    } catch {
      // Handle error
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary pb-24 px-4 pt-6">
      <div className="max-w-lg mx-auto">
        <h2 className="text-2xl font-bold text-jb-text-primary mb-4">Song History</h2>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-jb-text-primary mb-2">No history yet</h3>
            <p className="text-jb-text-secondary">Songs you play will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="relative">
                <SongCard
                  title={item.song.title}
                  artist={item.song.artist}
                  coverArtUrl={item.song.coverArtUrl}
                  duration={formatDuration(item.song.duration)}
                  onClick={() => handleRequeue(item.song.id)}
                />
                <div className="flex items-center justify-between px-3 mt-1">
                  <span className="text-jb-text-secondary text-[10px]">
                    {new Date(item.playedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="text-jb-text-secondary text-[10px]">{item.venueName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
