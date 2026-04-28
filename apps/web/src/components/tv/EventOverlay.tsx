import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// Event Types
// ============================================
interface SilenceEvent {
  type: 'silence';
  duration: number;
  startedAt: string;
  userName?: string;
}

interface TextMessageEvent {
  type: 'textMessage';
  message: string;
  userName?: string;
  duration: number;
}

interface VoiceMessageEvent {
  type: 'voiceMessage';
  audioUrl: string;
  userName?: string;
  duration?: number;
}

interface PhotoEvent {
  type: 'photo';
  photoUrl: string;
  userName?: string;
}

interface VideoEvent {
  type: 'video';
  videoUrl: string;
  userName?: string;
  duration?: number;
}

interface ReactionEvent {
  type: 'reaction';
  reactionType: string;
  userName?: string;
  duration?: number;
}

interface BirthdayEvent {
  type: 'birthday';
  name: string;
  message?: string;
  songTitle?: string;
  userName?: string;
}

type SpecialEvent = SilenceEvent | TextMessageEvent | VoiceMessageEvent | PhotoEvent | VideoEvent | ReactionEvent | BirthdayEvent;

interface EventOverlayProps {
  onMuteAudio?: () => void;
  onUnmuteAudio?: () => void;
  /** When true, voice-message and video overlays render silently. Use for mirror displays (e.g. customer phones). */
  muteMedia?: boolean;
}

// ============================================
// Reaction Particles Component
// ============================================
const REACTION_EMOJIS: Record<string, string> = {
  APPLAUSE: '\uD83D\uDC4F',
  BOO: '\uD83D\uDC4E',
  LAUGH: '\uD83D\uDE02',
  HEART: '\u2764\uFE0F',
  FIRE: '\uD83D\uDD25',
};

const ReactionParticles: React.FC<{ reactionType: string }> = ({ reactionType }) => {
  const emoji = REACTION_EMOJIS[reactionType] || reactionType;
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    size: 24 + Math.random() * 24,
    duration: 2 + Math.random() * 2,
  }));

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: '100vh', opacity: 1, scale: 0.5, rotate: Math.random() * 360 }}
          animate={{ y: '-20vh', opacity: 0, scale: 1, rotate: Math.random() * 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
          style={{ position: 'absolute', fontSize: p.size }}
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// Confetti Component
// ============================================
const Confetti: React.FC = () => {
  const colors = ['#00FF00', '#9B00FF', '#FF0080', '#FFD700', '#00BFFF'];
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: colors[i % colors.length],
    delay: Math.random() * 1,
    size: 6 + Math.random() * 8,
    duration: 3 + Math.random() * 2,
  }));

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: '-5vh', opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: 0, rotate: Math.random() * 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// Main EventOverlay Component
// ============================================
export const EventOverlay: React.FC<EventOverlayProps> = ({ onMuteAudio, onUnmuteAudio, muteMedia = false }) => {
  const [activeEvent, setActiveEvent] = useState<SpecialEvent | null>(null);
  const [countdown, setCountdown] = useState(0);
  const eventQueueRef = useRef<SpecialEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const processNextEvent = useCallback(() => {
    if (eventQueueRef.current.length === 0) {
      setActiveEvent(null);
      return;
    }
    const next = eventQueueRef.current.shift()!;
    setActiveEvent(next);
  }, []);

  // Queue an event
  const queueEvent = useCallback((event: SpecialEvent) => {
    // Reactions and text messages can overlay immediately
    if (event.type === 'reaction') {
      setActiveEvent(event);
      return;
    }
    // For other events, queue them
    if (!activeEvent || activeEvent.type === 'reaction') {
      setActiveEvent(event);
    } else {
      eventQueueRef.current.push(event);
    }
  }, [activeEvent]);

  // Handle event completion
  useEffect(() => {
    if (!activeEvent) return;

    let duration = 0;
    switch (activeEvent.type) {
      case 'silence': {
        duration = activeEvent.duration * 1000;
        setCountdown(activeEvent.duration);
        const mode = (activeEvent as any).mode || 'between';
        if (mode === 'immediate') {
          // Stop current song immediately
          onMuteAudio?.();
        }
        // For 'between' mode: don't mute now, just queue the silence overlay
        // (audio will continue until the song ends naturally, then next song is delayed)
        break;
      }
      case 'textMessage':
        duration = activeEvent.duration * 1000;
        break;
      case 'voiceMessage':
        duration = (activeEvent.duration || 15) * 1000;
        onMuteAudio?.();
        break;
      case 'photo':
        duration = ((activeEvent as any).duration || 180) * 1000;
        break;
      case 'video':
        duration = ((activeEvent as VideoEvent).duration || 20) * 1000;
        onMuteAudio?.();
        break;
      case 'reaction':
        duration = ((activeEvent as ReactionEvent).duration || 4) * 1000;
        break;
      case 'birthday':
        // Use duration from event (default 86400s = 24h for corner, 15s for fullscreen)
        duration = ((activeEvent as any).duration || ((activeEvent as any).mode === 'fullscreen' ? 15 : 86400)) * 1000;
        break;
    }

    timerRef.current = setTimeout(() => {
      if (activeEvent.type === 'silence' || activeEvent.type === 'voiceMessage' || activeEvent.type === 'video') {
        onUnmuteAudio?.();
      }
      setActiveEvent(null);
      setCountdown(0);
      // Process next event
      setTimeout(processNextEvent, 500);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeEvent, onMuteAudio, onUnmuteAudio, processNextEvent]);

  // Countdown timer for silence
  useEffect(() => {
    if (activeEvent?.type !== 'silence' || countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeEvent?.type, countdown > 0]);

  // Expose queueEvent for parent component
  useEffect(() => {
    (window as any).__jb_queueEvent = queueEvent;
    return () => { delete (window as any).__jb_queueEvent; };
  }, [queueEvent]);

  return (
    <AnimatePresence>
      {/* SILENCE OVERLAY */}
      {activeEvent?.type === 'silence' && (
        <motion.div
          key="silence"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
        >
          <div className="text-center">
            <motion.h2
              className="text-7xl font-bold text-jb-highlight-pink mb-8"
              style={{ textShadow: '0 0 40px #FF0080, 0 0 80px #FF0080' }}
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              SILENCE
            </motion.h2>
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <motion.circle
                  cx="50" cy="50" r="45" fill="none" stroke="#FF0080" strokeWidth="4"
                  strokeDasharray={283}
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: 283 }}
                  transition={{ duration: (activeEvent as SilenceEvent).duration, ease: 'linear' }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl font-bold text-white">{countdown}</span>
              </div>
            </div>
            {activeEvent.userName && (
              <p className="text-jb-text-secondary text-lg">Requested by {activeEvent.userName}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* TEXT MESSAGE OVERLAY */}
      {activeEvent?.type === 'textMessage' && (
        <motion.div
          key="text"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          className="fixed bottom-32 left-0 right-0 z-50 px-8"
        >
          <div className="max-w-3xl mx-auto bg-black/70 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
            {activeEvent.userName && (
              <p className="text-jb-accent-purple text-lg mb-2">{activeEvent.userName} says:</p>
            )}
            <p
              className="text-3xl font-bold text-white leading-relaxed"
              style={{ textShadow: '0 0 20px #00FF00, 0 0 40px #9B00FF' }}
            >
              {(activeEvent as TextMessageEvent).message}
            </p>
          </div>
        </motion.div>
      )}

      {/* VOICE MESSAGE OVERLAY */}
      {activeEvent?.type === 'voiceMessage' && (
        <motion.div
          key="voice"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
        >
          <div className="text-center">
            <motion.div
              className="text-6xl mb-6"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              {'\uD83C\uDF99\uFE0F'}
            </motion.div>
            <h2 className="text-4xl font-bold text-jb-accent-green mb-4">Voice Message</h2>
            {activeEvent.userName && (
              <p className="text-jb-text-secondary text-xl">from {activeEvent.userName}</p>
            )}
            {/* Sound wave animation */}
            <div className="flex items-center justify-center gap-1 mt-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 bg-jb-accent-green rounded-full"
                  animate={{ height: [8, 32 + Math.random() * 24, 8] }}
                  transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, delay: i * 0.05 }}
                />
              ))}
            </div>
          </div>
          {/* Hidden audio playback */}
          {!muteMedia && <audio src={(activeEvent as VoiceMessageEvent).audioUrl} autoPlay />}
        </motion.div>
      )}

      {/* PHOTO OVERLAY */}
      {activeEvent?.type === 'photo' && (() => {
        const mode = (activeEvent as any).mode || 'corner';
        if (mode === 'corner') {
          return (
            <motion.div
              key="photo-corner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-6 z-40"
            >
              <motion.div
                className="p-1 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #00FF00, #9B00FF, #FF0080, #00FF00)',
                  backgroundSize: '300% 300%',
                }}
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <img
                  src={(activeEvent as PhotoEvent).photoUrl}
                  alt="User photo"
                  className="w-48 h-48 rounded-lg object-cover bg-black"
                />
              </motion.div>
              {activeEvent.userName && (
                <p className="text-center text-jb-text-secondary text-xs mt-2 bg-black/60 rounded px-2 py-1">
                  {activeEvent.userName}
                </p>
              )}
            </motion.div>
          );
        }
        // Fullscreen mode (original)
        return (
          <motion.div
            key="photo-full"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="relative">
              <motion.div
                className="p-2 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #00FF00, #9B00FF, #FF0080, #00FF00)',
                  backgroundSize: '300% 300%',
                }}
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <img
                  src={(activeEvent as PhotoEvent).photoUrl}
                  alt="User photo"
                  className="max-w-lg max-h-[60vh] rounded-xl object-contain bg-black"
                />
              </motion.div>
              {activeEvent.userName && (
                <p className="text-center text-jb-text-secondary text-xl mt-4">
                  Shared by {activeEvent.userName}
                </p>
              )}
            </div>
          </motion.div>
        );
      })()}

      {/* VIDEO OVERLAY */}
      {activeEvent?.type === 'video' && (() => {
        const mode = (activeEvent as any).mode || 'fullscreen';
        if (mode === 'corner') {
          return (
            <motion.div
              key="video-corner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 right-6 z-40"
            >
              <motion.div
                className="p-1 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #00FF00, #9B00FF, #FF0080, #00FF00)',
                  backgroundSize: '300% 300%',
                }}
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <video
                  src={(activeEvent as VideoEvent).videoUrl}
                  autoPlay
                  playsInline
                  muted={muteMedia}
                  className="w-64 h-48 rounded-lg object-cover bg-black"
                />
              </motion.div>
              {activeEvent.userName && (
                <p className="text-center text-jb-text-secondary text-xs mt-2 bg-black/60 rounded px-2 py-1">
                  {activeEvent.userName}
                </p>
              )}
            </motion.div>
          );
        }
        return (
          <motion.div
            key="video-full"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="relative">
              <motion.div
                className="p-2 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #00FF00, #9B00FF, #FF0080, #00FF00)',
                  backgroundSize: '300% 300%',
                }}
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <video
                  src={(activeEvent as VideoEvent).videoUrl}
                  autoPlay
                  playsInline
                  muted={muteMedia}
                  className="max-w-2xl max-h-[70vh] rounded-xl object-contain bg-black"
                />
              </motion.div>
              {activeEvent.userName && (
                <p className="text-center text-jb-text-secondary text-xl mt-4">
                  Shared by {activeEvent.userName}
                </p>
              )}
            </div>
          </motion.div>
        );
      })()}

      {/* REACTION OVERLAY */}
      {activeEvent?.type === 'reaction' && (
        <ReactionParticles reactionType={(activeEvent as ReactionEvent).reactionType} />
      )}

      {/* BIRTHDAY OVERLAY */}
      {activeEvent?.type === 'birthday' && (() => {
        const mode = (activeEvent as any).mode || 'corner';
        if (mode === 'corner') {
          return (
            <motion.div
              key="birthday-corner"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 right-6 z-40 max-w-xs"
            >
              <div className="bg-gradient-to-r from-jb-highlight-pink/90 to-jb-accent-purple/90 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="text-4xl"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {'\uD83C\uDF82'}
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-bold uppercase tracking-wider">Happy Birthday</p>
                    <p className="text-jb-accent-green text-lg font-bold truncate">
                      {(activeEvent as BirthdayEvent).name}!
                    </p>
                    {(activeEvent as BirthdayEvent).message && (
                      <p className="text-white/80 text-xs truncate mt-0.5">
                        {(activeEvent as BirthdayEvent).message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        }
        // Fullscreen mode (original with confetti)
        return (
          <motion.div
            key="birthday-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
          >
            <Confetti />
            <div className="text-center relative z-10">
              <motion.div
                className="text-8xl mb-6"
                animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {'\uD83C\uDF82'}
              </motion.div>
              <motion.h2
                className="text-6xl font-bold mb-6"
                style={{ textShadow: '0 0 40px #FF0080, 0 0 80px #9B00FF' }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-jb-highlight-pink">Happy Birthday</span>
                <br />
                <span className="text-jb-accent-green neon-text-green">
                  {(activeEvent as BirthdayEvent).name}!
                </span>
              </motion.h2>
              {(activeEvent as BirthdayEvent).message && (
                <p className="text-2xl text-white/80 mt-4 max-w-xl">
                  {(activeEvent as BirthdayEvent).message}
                </p>
              )}
              {(activeEvent as BirthdayEvent).songTitle && (
                <p className="text-xl text-jb-accent-purple mt-4">
                  Now playing: {(activeEvent as BirthdayEvent).songTitle}
                </p>
              )}
            </div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
};
