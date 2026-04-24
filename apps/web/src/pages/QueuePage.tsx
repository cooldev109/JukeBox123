import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QueueItemComponent, MusicVisualizer } from '@jukebox/ui';
import { useQueueStore } from '../stores/queueStore';
import { useI18n } from '../lib/i18n';
import { EventOverlay } from '../components/tv/EventOverlay';
import { getSocket } from '../lib/socket';

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const QueuePage: React.FC = () => {
  const { t } = useI18n();
  const { queue, nowPlaying, machineId, fetchQueue, fetchNowPlaying } = useQueueStore();

  useEffect(() => {
    if (machineId) {
      fetchQueue(machineId);
      fetchNowPlaying(machineId);
    }
  }, [machineId]);

  // Mirror the TV's special event overlays on the customer's phone.
  // Audio handlers are no-ops because phones don't play the music — the TV does.
  useEffect(() => {
    if (!machineId) return;
    const socket = getSocket();
    const queueEvent = (event: any) => {
      const fn = (window as any).__jb_queueEvent;
      if (fn) fn(event);
    };

    socket.on('event:silence', (data: any) => queueEvent({ type: 'silence', ...data }));
    socket.on('event:textMessage', (data: any) => queueEvent({ type: 'textMessage', ...data }));
    socket.on('event:voiceMessage', (data: any) => queueEvent({ type: 'voiceMessage', ...data }));
    socket.on('event:photo', (data: any) => queueEvent({ type: 'photo', ...data }));
    socket.on('event:video', (data: any) => queueEvent({ type: 'video', ...data }));
    socket.on('event:reaction', (data: any) =>
      queueEvent({ type: 'reaction', reactionType: data.type, userName: data.userName })
    );
    socket.on('event:birthday', (data: any) => queueEvent({ type: 'birthday', ...data }));

    return () => {
      socket.off('event:silence');
      socket.off('event:textMessage');
      socket.off('event:voiceMessage');
      socket.off('event:photo');
      socket.off('event:video');
      socket.off('event:reaction');
      socket.off('event:birthday');
    };
  }, [machineId]);

  const np = nowPlaying?.queueItem;
  const progress = nowPlaying?.progress;

  return (
    <div className="min-h-screen bg-jb-bg-primary pb-24">
      {/* Now Playing Section */}
      {np ? (
        <div className="relative overflow-hidden">
          {/* Background blur image */}
          {np.song.coverArtUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-10 blur-2xl scale-110"
              style={{ backgroundImage: `url(${np.song.coverArtUrl})` }}
            />
          )}
          <div className="relative px-4 pt-8 pb-6 bg-gradient-to-b from-transparent to-jb-bg-primary">
            <div className="max-w-lg mx-auto text-center">
              {/* Album Art */}
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="w-48 h-48 mx-auto rounded-2xl overflow-hidden shadow-glow-purple mb-4"
              >
                {np.song.coverArtUrl ? (
                  <img src={np.song.coverArtUrl} alt={np.song.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-jb-bg-secondary flex items-center justify-center">
                    <svg className="w-20 h-20 text-jb-accent-purple" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
              </motion.div>

              <h2 className="text-2xl font-bold text-jb-text-primary mb-1">{np.song.title}</h2>
              <p className="text-jb-text-secondary mb-3">{np.song.artist}</p>

              {/* Visualizer */}
              <div className="flex justify-center mb-4">
                <MusicVisualizer isPlaying size="md" barCount={7} />
              </div>

              {/* Progress Bar */}
              {progress && (
                <div className="space-y-1">
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-jb-accent-green rounded-full"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-jb-text-secondary">
                    <span>{formatDuration(progress.elapsed)}</span>
                    <span>{formatDuration(progress.duration)}</span>
                  </div>
                </div>
              )}

              {np.isPriority && (
                <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-jb-highlight-pink/20 text-jb-highlight-pink border border-jb-highlight-pink/30">
                  VIP
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pt-8 pb-6 text-center">
          <div className="max-w-lg mx-auto">
            <div className="text-5xl mb-4">🎶</div>
            <h2 className="text-xl font-bold text-jb-text-primary mb-2">No song playing</h2>
            <p className="text-jb-text-secondary">Be the first to add a song!</p>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="px-4 mt-4">
        <div className="max-w-lg mx-auto">
          <h3 className="text-lg font-bold text-jb-text-primary mb-3">
            {t('up_next')}
            {queue.length > 0 && (
              <span className="text-jb-text-secondary font-normal text-sm ml-2">
                ({queue.length} {t('songs_in_queue')})
              </span>
            )}
          </h3>

          {queue.length === 0 ? (
            <div className="text-center py-8 text-jb-text-secondary">
              <p className="font-bold mb-1">{t('queue_empty')}</p>
              <p className="text-sm">{t('queue_empty_desc')}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {queue.map((item, index) => (
                  <QueueItemComponent
                    key={item.id}
                    position={index + 1}
                    title={item.song.title}
                    artist={item.song.artist}
                    coverArtUrl={item.song.coverArtUrl}
                    isPriority={item.isPriority}
                    estimatedWait={`~${(index + 1) * 3} min`}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Shared TV overlays — every customer sees the same photo/video/reaction/birthday */}
      <EventOverlay />
    </div>
  );
};
