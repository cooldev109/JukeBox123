import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicVisualizer } from '@jukebox/ui';
import { useTvPlayerStore } from '../stores/tvPlayerStore';
import { useAuthStore } from '../stores/authStore';

// Audio visualizer using canvas
const AudioVisualizer: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const bars = 64;
    const barWidth = canvas.offsetWidth / bars - 2;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      for (let i = 0; i < bars; i++) {
        const height = isPlaying
          ? Math.random() * canvas.offsetHeight * 0.5 + canvas.offsetHeight * 0.1
          : canvas.offsetHeight * 0.05;

        // Gradient from green to purple
        const ratio = i / bars;
        const r = Math.round(0 + ratio * 155);
        const g = Math.round(255 - ratio * 255);
        const b = Math.round(0 + ratio * 255);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.fillRect(
          i * (barWidth + 2),
          canvas.offsetHeight - height,
          barWidth,
          height,
        );
      }

      animRef.current = window.requestAnimationFrame(draw);
    };

    draw();
    return () => window.cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

// Format seconds to MM:SS
const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const TvPlayerPage: React.FC = () => {
  const {
    machineId,
    machineName,
    venueName,
    queue,
    currentItem,
    isPlaying,
    progress,
    elapsed,
    duration,
    volume,
    showQueue,
    overlayText,
    isConnected,
    isIdle,
    restoreState,
    fetchMachineInfo,
    fetchQueue,
    startListening,
    stopListening,
    playNext,
    setProgress,
    setIsPlaying,
    sendHeartbeat,
    saveState,
  } = useTvPlayerStore();

  const { isAuthenticated, fetchMe } = useAuthStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const [machineInput, setMachineInput] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const { login } = useAuthStore();

  // Restore state on mount
  useEffect(() => {
    restoreState();
    if (isAuthenticated) fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup machine connection
  useEffect(() => {
    if (!machineId) return;
    fetchMachineInfo();
    fetchQueue();
    startListening();

    // Heartbeat every 30 seconds
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat();
      saveState();
    }, 30000);

    return () => {
      stopListening();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId]);

  // Handle audio playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentItem) return;

    // Use the song's file URL (direct MP3 link)
    const audioUrl = currentItem.song.fileUrl;
    if (!audioUrl) return;
    audio.src = audioUrl;
    audio.volume = volume / 100;
    audio.play().catch((err) => {
      console.error('Audio play failed:', err.message, '| URL:', audioUrl);
    });
    setIsPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.id]);

  // Volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Audio event handlers
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime, audio.duration || 0);
  }, [setProgress]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    playNext();
  }, [setIsPlaying, playNext]);

  const handleError = useCallback(() => {
    const audio = audioRef.current;
    const error = audio?.error;
    // Don't skip on MEDIA_ERR_ABORTED (1) — often caused by src change
    if (error && error.code !== 1) {
      console.error('Skipping song due to audio error:', error.code, error.message);
      playNext();
    }
  }, [playNext]);

  // Handle autoplay block — retry play on user click
  const handleUserInteraction = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.paused && currentItem) {
      audio.play().catch(() => {});
    }
    document.documentElement.requestFullscreen?.();
  }, [currentItem]);

  // Machine setup screen
  if (!machineId) {
    return (
      <div
        className="min-h-screen bg-jb-bg-primary flex items-center justify-center"
        onClick={() => document.documentElement.requestFullscreen?.()}
      >
        <div className="w-full max-w-md p-8">
          <h1 className="text-5xl font-bold text-jb-accent-green neon-text-green text-center mb-2">
            JukeBox
          </h1>
          <p className="text-jb-text-secondary text-center mb-8">
            TV Player Setup
          </p>

          {!isAuthenticated ? (
            <div className="glass rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-jb-text-primary text-center">
                Login Required
              </h2>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg text-jb-text-primary px-4 py-3 focus:outline-none focus:border-jb-accent-purple"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg text-jb-text-primary px-4 py-3 focus:outline-none focus:border-jb-accent-purple"
              />
              {error && (
                <p className="text-jb-highlight-pink text-sm text-center">
                  {error}
                </p>
              )}
              <button
                onClick={async () => {
                  try {
                    await login(email, password);
                    setError('');
                  } catch {
                    setError('Login failed');
                  }
                }}
                className="w-full bg-jb-accent-green text-jb-bg-primary font-bold py-3 rounded-lg hover:shadow-glow-green transition-all"
              >
                Login
              </button>
            </div>
          ) : (
            <div className="glass rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-jb-text-primary text-center">
                Select Machine
              </h2>
              <p className="text-jb-text-secondary text-sm text-center">
                Enter your machine ID
              </p>
              <input
                type="text"
                placeholder="Machine ID"
                value={machineInput}
                onChange={(e) => setMachineInput(e.target.value)}
                className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg text-jb-text-primary px-4 py-3 focus:outline-none focus:border-jb-accent-purple"
              />
              <button
                onClick={() => {
                  if (machineInput.trim()) {
                    useTvPlayerStore
                      .getState()
                      .setMachineId(machineInput.trim());
                  }
                }}
                className="w-full bg-jb-accent-green text-jb-bg-primary font-bold py-3 rounded-lg hover:shadow-glow-green transition-all"
              >
                Start Player
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main TV Player UI
  const song = currentItem?.song;

  return (
    <div
      className="w-screen h-screen bg-jb-bg-primary overflow-hidden relative"
      onClick={handleUserInteraction}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={(e) => {
          console.error('Audio error:', (e.target as HTMLAudioElement).error);
          handleError();
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Background */}
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

      {/* Main content area */}
      <div className="relative z-10 w-full h-full flex">
        {/* Left: Now Playing */}
        <div
          className={`flex-1 flex flex-col items-center justify-center p-8 ${showQueue ? 'pr-4' : ''}`}
        >
          {isIdle && !song ? (
            /* Idle Mode */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <motion.h1
                className="text-8xl font-bold text-jb-accent-green neon-text-green mb-4"
                animate={{ opacity: [1, 0.8, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                JukeBox
              </motion.h1>
              <p className="text-3xl text-jb-text-secondary mb-8">
                {venueName || 'Your music, your bar'}
              </p>
              <p className="text-xl text-jb-text-secondary/60">
                Scan the QR code to add songs!
              </p>
              <div className="mt-12">
                <MusicVisualizer isPlaying={false} size="lg" barCount={9} />
              </div>
            </motion.div>
          ) : song ? (
            /* Now Playing Display */
            <AnimatePresence mode="wait">
              <motion.div
                key={currentItem?.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="text-center max-w-2xl"
              >
                {/* Album Art */}
                <motion.div
                  className="w-80 h-80 mx-auto rounded-3xl overflow-hidden shadow-glow-purple mb-8"
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  {song.coverArtUrl ? (
                    <img
                      src={song.coverArtUrl}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-jb-accent-purple to-jb-highlight-pink flex items-center justify-center">
                      <svg
                        className="w-32 h-32 text-white/50"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                </motion.div>

                {/* Song Info */}
                <h2 className="text-5xl font-bold text-jb-text-primary mb-3 neon-text-green">
                  {song.title}
                </h2>
                <p className="text-3xl text-jb-text-secondary mb-2">
                  {song.artist}
                </p>
                {song.album && (
                  <p className="text-xl text-jb-text-secondary/60">
                    {song.album}
                  </p>
                )}

                {currentItem?.isPriority && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-block mt-4 px-4 py-1.5 rounded-full text-sm font-bold bg-jb-highlight-pink/20 text-jb-highlight-pink border border-jb-highlight-pink/30"
                  >
                    VIP Request
                  </motion.span>
                )}

                {/* Visualizer */}
                <div className="mt-8 h-20">
                  <AudioVisualizer isPlaying={isPlaying} />
                </div>
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        {/* Right: Queue Panel */}
        <AnimatePresence>
          {showQueue && (
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-96 bg-jb-bg-primary/80 backdrop-blur-xl border-l border-white/10 flex flex-col"
            >
              <div className="p-4 border-b border-white/10">
                <h3 className="text-lg font-bold text-jb-accent-green">
                  Up Next
                </h3>
                <p className="text-jb-text-secondary text-xs">
                  {queue.length} songs in queue
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {queue.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      item.id === currentItem?.id
                        ? 'bg-jb-accent-green/10 border border-jb-accent-green/30'
                        : 'bg-white/5'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                        item.id === currentItem?.id
                          ? 'bg-jb-accent-green text-jb-bg-primary'
                          : 'bg-jb-bg-secondary text-jb-text-secondary'
                      }`}
                    >
                      {item.id === currentItem?.id ? '\u25B6' : i + 1}
                    </span>
                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-jb-bg-secondary">
                      {item.song.coverArtUrl ? (
                        <img
                          src={item.song.coverArtUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-jb-accent-purple"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-jb-text-primary text-sm font-medium truncate">
                        {item.song.title}
                      </p>
                      <p className="text-jb-text-secondary text-xs truncate">
                        {item.song.artist}
                      </p>
                    </div>
                    {item.isPriority && (
                      <span className="text-[10px] font-bold text-jb-highlight-pink bg-jb-highlight-pink/20 px-2 py-0.5 rounded-full">
                        VIP
                      </span>
                    )}
                  </motion.div>
                ))}
                {queue.length === 0 && (
                  <p className="text-jb-text-secondary text-sm text-center py-8">
                    Queue is empty
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar: Progress + Song Info */}
      {song && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          {/* Progress Bar */}
          <div className="w-full h-1 bg-white/10">
            <motion.div
              className="h-full bg-jb-accent-green"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex items-center justify-between px-6 py-3 bg-jb-bg-primary/80 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <MusicVisualizer isPlaying={isPlaying} size="sm" barCount={4} />
              <div>
                <p className="text-jb-text-primary font-bold">{song.title}</p>
                <p className="text-jb-text-secondary text-sm">{song.artist}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-jb-text-secondary text-sm">
              <span>
                {formatTime(elapsed)} / {formatTime(duration)}
              </span>
              {currentItem?.user && (
                <span className="text-jb-accent-purple">
                  Requested by {currentItem.user.name}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Bar: Status + Venue */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 bg-gradient-to-b from-jb-bg-primary/80 to-transparent">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-jb-accent-green neon-text-green">
            JukeBox
          </h1>
          {venueName && (
            <span className="text-jb-text-secondary text-sm">
              | {venueName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {overlayText && (
            <span className="text-jb-highlight-pink text-sm font-bold">
              {overlayText}
            </span>
          )}
          <div
            className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-jb-accent-green animate-pulse' : 'bg-red-500'}`}
          />
        </div>
      </div>

      {/* QR Code corner -- always visible */}
      <div className="absolute bottom-20 right-6 z-20 bg-white p-3 rounded-xl shadow-glow-green">
        <div className="w-24 h-24 bg-jb-bg-primary flex items-center justify-center rounded">
          <span className="text-jb-accent-green text-[10px] text-center font-bold leading-tight">
            Scan to
            <br />
            add songs
          </span>
        </div>
      </div>
    </div>
  );
};
