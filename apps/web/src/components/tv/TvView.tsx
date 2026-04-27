import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { useQueueStore } from '../../stores/queueStore';

interface TvViewProps {
  /** Close the TV view (exits fullscreen and returns to normal page). */
  onClose: () => void;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/**
 * In-page TV view — renders the same layout as /tv-player but without audio,
 * using data the Queue page already has. Meant to be used inside a fullscreen
 * container on phones, tablets, Smart TVs, or casted Chrome tabs.
 */
export const TvView: React.FC<TvViewProps> = ({ onClose }) => {
  const { queue, nowPlaying, venueName, venueCode } = useQueueStore();
  // If nothing is currently PLAYING, fall back to the first PENDING song so
  // the TV view doesn't look idle when there are queued songs waiting.
  const playingItem = nowPlaying?.queueItem;
  const firstPending = queue.find((q) => q.status === 'PENDING');
  const item = playingItem || firstPending;
  const progress = playingItem ? nowPlaying?.progress : null;
  const song = item?.song;

  // Upcoming songs: exclude whichever item we showed in Now Playing
  const upcoming = queue
    .filter((q) => q.status !== 'PLAYING' && q.id !== item?.id)
    .slice(0, 10);

  return (
    <div className="w-full h-full bg-jb-bg-primary overflow-hidden relative">
      {/* Background: blurred album art or gradient */}
      {song?.coverArtUrl ? (
        <motion.div
          key={song.coverArtUrl}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          className="absolute inset-0 bg-cover bg-center blur-3xl scale-110"
          style={{ backgroundImage: `url(${song.coverArtUrl})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-jb-bg-primary via-jb-bg-secondary to-jb-accent-purple/10" />
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 md:px-6 py-2 md:py-3 bg-gradient-to-b from-jb-bg-primary/80 to-transparent">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <img src="/logo.png" alt="JukeBox" className="h-6 md:h-8" />
          {venueName && (
            <span className="text-jb-text-secondary text-xs md:text-sm truncate">| {venueName}</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-jb-text-secondary hover:text-jb-accent-green text-sm bg-black/40 rounded-full px-3 py-1.5"
          aria-label="Close TV view"
        >
          ✕ Exit TV
        </button>
      </div>

      {/* Main content area */}
      <div className="relative z-10 w-full h-full flex flex-col md:flex-row">
        {/* Now Playing */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          {song ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={item?.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="text-center max-w-2xl"
              >
                <motion.div
                  className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 mx-auto rounded-3xl overflow-hidden shadow-glow-purple mb-4 md:mb-8"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  {song.coverArtUrl ? (
                    <img src={song.coverArtUrl} alt={song.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-jb-accent-purple to-jb-highlight-pink flex items-center justify-center">
                      <svg className="w-20 h-20 md:w-32 md:h-32 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                </motion.div>

                <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-jb-text-primary mb-2 md:mb-3 neon-text-green break-words">
                  {song.title}
                </h2>
                <p className="text-lg sm:text-xl md:text-3xl text-jb-text-secondary mb-1 md:mb-2 break-words">
                  {song.artist}
                </p>
                {song.album && (
                  <p className="text-sm md:text-xl text-jb-text-secondary/60 break-words">{song.album}</p>
                )}

                {item?.isPriority && (
                  <span className="inline-block mt-3 px-3 py-1 rounded-full text-xs md:text-sm font-bold bg-jb-highlight-pink/20 text-jb-highlight-pink border border-jb-highlight-pink/30">
                    VIP Request
                  </span>
                )}

                {/* Progress */}
                {progress && (
                  <div className="mt-6 max-w-md mx-auto">
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-jb-accent-green"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-jb-text-secondary mt-1">
                      <span>{formatTime(progress.elapsed)}</span>
                      <span>{formatTime(progress.duration)}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <img src="/logo.png" alt="JukeBox" className="h-20 md:h-32 mx-auto mb-4" />
              <p className="text-xl md:text-3xl text-jb-text-secondary mb-4 md:mb-8">
                {venueName || 'Your music, your bar'}
              </p>
              <p className="text-base md:text-xl text-jb-text-secondary/60">
                Scan the QR code to add songs!
              </p>
            </motion.div>
          )}
        </div>

        {/* Queue side panel — visible only on tablets and up */}
        {upcoming.length > 0 && (
          <div className="hidden md:flex w-80 lg:w-96 bg-jb-bg-primary/70 backdrop-blur-xl border-l border-white/10 flex-col">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-jb-accent-green">Up Next</h3>
              <p className="text-jb-text-secondary text-xs">{upcoming.length} in queue</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {upcoming.map((q, i) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                >
                  <span className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold bg-jb-bg-secondary text-jb-text-secondary">
                    {i + 1}
                  </span>
                  <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0 bg-jb-bg-secondary">
                    {q.song.coverArtUrl ? (
                      <img src={q.song.coverArtUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-jb-accent-purple" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-jb-text-primary text-xs font-medium truncate">{q.song.title}</p>
                    <p className="text-jb-text-secondary text-[10px] truncate">{q.song.artist}</p>
                  </div>
                  {q.isPriority && (
                    <span className="text-[9px] font-bold text-jb-highlight-pink bg-jb-highlight-pink/20 px-1.5 py-0.5 rounded-full">
                      VIP
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QR Code for customers to scan */}
      {venueCode && (
        <div className="absolute bottom-3 right-3 md:bottom-6 md:right-6 z-20 bg-white rounded-xl p-2 md:p-3 shadow-2xl flex flex-col items-center gap-1">
          <QRCodeCanvas
            value={`${window.location.origin}/browse?venue=${encodeURIComponent(venueCode)}`}
            size={72}
            level="M"
            marginSize={0}
            className="md:!w-[120px] md:!h-[120px]"
          />
          <p className="text-black text-[10px] md:text-xs font-bold">{venueCode}</p>
          <p className="text-gray-600 text-[9px] md:text-[10px] hidden md:block">Scan to play music</p>
        </div>
      )}
    </div>
  );
};
