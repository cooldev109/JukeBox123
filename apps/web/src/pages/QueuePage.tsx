import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QueueItemComponent, MusicVisualizer } from '@jukebox/ui';
import { useQueueStore } from '../stores/queueStore';
import { useI18n } from '../lib/i18n';
import { EventOverlay } from '../components/tv/EventOverlay';
import { getSocket } from '../lib/socket';

interface EventHistoryItem {
  id: string;
  type: 'photo' | 'video' | 'textMessage' | 'reaction' | 'birthday' | 'voiceMessage';
  userName?: string;
  photoUrl?: string;
  videoUrl?: string;
  message?: string;
  reactionType?: string;
  name?: string;
  at: number;
}

const REACTION_EMOJI: Record<string, string> = {
  APPLAUSE: '👏',
  BOO: '👎',
  LAUGH: '😂',
  HEART: '❤️',
  FIRE: '🔥',
};

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const QueuePage: React.FC = () => {
  const { t } = useI18n();
  const { queue, nowPlaying, machineId, fetchQueue, fetchNowPlaying } = useQueueStore();
  const [eventHistory, setEventHistory] = useState<EventHistoryItem[]>([]);

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

    const pushHistory = (item: Omit<EventHistoryItem, 'id' | 'at'>) => {
      setEventHistory((prev) => {
        const next: EventHistoryItem = {
          id: `${Date.now()}-${Math.random()}`,
          at: Date.now(),
          ...item,
        };
        // Keep only the most recent 30 items
        return [next, ...prev].slice(0, 30);
      });
    };

    socket.on('event:silence', (data: any) => queueEvent({ type: 'silence', ...data }));
    socket.on('event:textMessage', (data: any) => {
      queueEvent({ type: 'textMessage', ...data });
      pushHistory({ type: 'textMessage', message: data.message, userName: data.userName });
    });
    socket.on('event:voiceMessage', (data: any) => {
      queueEvent({ type: 'voiceMessage', ...data });
      pushHistory({ type: 'voiceMessage', userName: data.userName });
    });
    socket.on('event:photo', (data: any) => {
      queueEvent({ type: 'photo', ...data });
      pushHistory({ type: 'photo', photoUrl: data.photoUrl, userName: data.userName });
    });
    socket.on('event:video', (data: any) => {
      queueEvent({ type: 'video', ...data });
      pushHistory({ type: 'video', videoUrl: data.videoUrl, userName: data.userName });
    });
    socket.on('event:reaction', (data: any) => {
      queueEvent({ type: 'reaction', reactionType: data.type, userName: data.userName });
      pushHistory({ type: 'reaction', reactionType: data.type, userName: data.userName });
    });
    socket.on('event:birthday', (data: any) => {
      queueEvent({ type: 'birthday', ...data });
      pushHistory({ type: 'birthday', name: data.name, userName: data.userName });
    });

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
  // "Up Next" should exclude the currently playing song (it's shown in the Now Playing section above).
  const upcomingQueue = queue.filter((item) => item.status !== 'PLAYING' && item.id !== np?.id);

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
            {upcomingQueue.length > 0 && (
              <span className="text-jb-text-secondary font-normal text-sm ml-2">
                ({upcomingQueue.length} {t('songs_in_queue')})
              </span>
            )}
          </h3>

          {upcomingQueue.length === 0 ? (
            <div className="text-center py-8 text-jb-text-secondary">
              <p className="font-bold mb-1">{t('queue_empty')}</p>
              <p className="text-sm">{t('queue_empty_desc')}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {upcomingQueue.map((item, index) => (
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

      {/* Event history — memes, photos, messages that have played on TV */}
      {eventHistory.length > 0 && (
        <div className="px-4 mt-8">
          <div className="max-w-lg mx-auto">
            <h3 className="text-lg font-bold text-jb-text-primary mb-3">Recent moments</h3>
            <div className="space-y-2">
              {eventHistory.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-white/5 rounded-xl p-3 border border-white/5 flex items-center gap-3"
                >
                  {ev.type === 'photo' && ev.photoUrl && (
                    <img src={ev.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-black" />
                  )}
                  {ev.type === 'video' && ev.videoUrl && (
                    <video src={ev.videoUrl} muted playsInline className="w-16 h-16 rounded-lg object-cover bg-black" />
                  )}
                  {ev.type === 'reaction' && (
                    <div className="w-12 h-12 rounded-full bg-jb-accent-purple/20 flex items-center justify-center text-2xl flex-shrink-0">
                      {REACTION_EMOJI[ev.reactionType || ''] || '✨'}
                    </div>
                  )}
                  {ev.type === 'birthday' && (
                    <div className="w-12 h-12 rounded-full bg-jb-highlight-pink/20 flex items-center justify-center text-2xl flex-shrink-0">
                      🎂
                    </div>
                  )}
                  {ev.type === 'textMessage' && (
                    <div className="w-12 h-12 rounded-full bg-jb-accent-green/20 flex items-center justify-center text-xl flex-shrink-0">
                      💬
                    </div>
                  )}
                  {ev.type === 'voiceMessage' && (
                    <div className="w-12 h-12 rounded-full bg-jb-accent-purple/20 flex items-center justify-center text-xl flex-shrink-0">
                      🎙️
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-jb-text-primary text-sm font-medium">
                      {ev.type === 'photo' && 'Photo'}
                      {ev.type === 'video' && 'Video'}
                      {ev.type === 'reaction' && 'Reaction'}
                      {ev.type === 'birthday' && `Happy Birthday, ${ev.name}!`}
                      {ev.type === 'textMessage' && 'Message'}
                      {ev.type === 'voiceMessage' && 'Voice message'}
                    </p>
                    {ev.type === 'textMessage' && ev.message && (
                      <p className="text-jb-text-secondary text-xs truncate">{ev.message}</p>
                    )}
                    {ev.userName && (
                      <p className="text-jb-text-secondary text-xs">by {ev.userName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shared TV overlays — every customer sees the same photo/video/reaction/birthday.
          muteMedia=true so phone doesn't duplicate the audio that the TV is already playing. */}
      <EventOverlay muteMedia />
    </div>
  );
};
