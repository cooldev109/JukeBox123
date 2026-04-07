import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Modal } from '@jukebox/ui';
import { useEventsStore } from '../stores/eventsStore';
import { useQueueStore } from '../stores/queueStore';
import { useWalletStore } from '../stores/walletStore';
import { MediaCapture } from '../components/MediaCapture';

const formatPrice = (reais: number): string => `R$ ${reais.toFixed(2)}`;

// Reaction emoji mapping
const REACTION_EMOJIS: Record<string, string> = {
  APPLAUSE: '\uD83D\uDC4F',
  BOO: '\uD83D\uDC4E',
  LAUGH: '\uD83D\uDE02',
  HEART: '\u2764\uFE0F',
  FIRE: '\uD83D\uDD25',
};

type ModalType = 'silence' | 'textMessage' | 'voiceMessage' | 'photo' | 'reaction' | 'birthday' | 'skipQueue' | null;

export const SpecialEventsPage: React.FC = () => {
  const { config, fetchConfig, isLoading, error, purchaseSilence, purchaseTextMessage, purchaseVoiceMessage, purchasePhoto, purchaseReaction, purchaseBirthday, purchaseSkipQueue } = useEventsStore();
  const { machineId, queue } = useQueueStore();
  const { balance, fetchWallet } = useWalletStore();

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Silence state
  const [selectedDuration, setSelectedDuration] = useState(60);

  // Text message state
  const [textMessage, setTextMessage] = useState('');

  // Reaction state
  const [selectedReaction, setSelectedReaction] = useState('');

  // Birthday state
  const [birthdayName, setBirthdayName] = useState('');
  const [birthdayMessage, setBirthdayMessage] = useState('');

  // Skip queue state
  const [selectedQueueItem, setSelectedQueueItem] = useState('');

  useEffect(() => {
    if (machineId) {
      fetchConfig(machineId);
    }
  }, [machineId, fetchConfig]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 4000);
  };

  const handlePurchase = async (action: () => Promise<any>, successMsg: string) => {
    try {
      await action();
      setActiveModal(null);
      await fetchWallet();
      showSuccess(successMsg);
    } catch (err: any) {
      showError(err.message || 'Purchase failed');
    }
  };

  // Get user's pending queue items for skip-queue
  const userQueueItems = queue.filter(
    (item: any) => item.status === 'PENDING'
  );

  if (!machineId) {
    return (
      <div className="p-6 text-center">
        <p className="text-jb-text-secondary">No machine connected. Please scan a venue QR code first.</p>
      </div>
    );
  }

  if (isLoading && !config) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-jb-accent-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const events = [
    {
      id: 'skipQueue' as ModalType,
      name: 'Skip Queue',
      icon: '\u26A1',
      price: config?.skipQueue.price ?? 5,
      enabled: (config?.skipQueue.enabled ?? false) && userQueueItems.length > 0,
      disabledReason: userQueueItems.length === 0 ? 'No songs in queue' : undefined,
      color: 'from-yellow-500 to-orange-500',
    },
    {
      id: 'silence' as ModalType,
      name: 'Silence',
      icon: '\uD83D\uDD07',
      price: config?.silence.options[0]?.price ?? 5,
      priceLabel: `from ${formatPrice(config?.silence.options[0]?.price ?? 5)}`,
      enabled: config?.silence.enabled ?? false,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      id: 'textMessage' as ModalType,
      name: 'Text Message',
      icon: '\uD83D\uDCAC',
      price: config?.textMessage.price ?? 2,
      enabled: config?.textMessage.enabled ?? false,
      color: 'from-green-500 to-teal-500',
    },
    {
      id: 'reaction' as ModalType,
      name: 'Reactions',
      icon: '\uD83C\uDF89',
      price: config?.reaction.price ?? 1,
      enabled: config?.reaction.enabled ?? false,
      color: 'from-pink-500 to-red-500',
    },
    {
      id: 'birthday' as ModalType,
      name: 'Birthday',
      icon: '\uD83C\uDF82',
      price: config?.birthday.price ?? 25,
      enabled: config?.birthday.enabled ?? false,
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'voiceMessage' as ModalType,
      name: 'Voice Message',
      icon: '\uD83C\uDF99\uFE0F',
      price: config?.voiceMessage.options[0]?.price ?? 8,
      priceLabel: `from ${formatPrice(config?.voiceMessage.options[0]?.price ?? 8)}`,
      enabled: config?.voiceMessage.enabled ?? false,
      color: 'from-cyan-500 to-blue-500',
    },
    {
      id: 'photo' as ModalType,
      name: 'Photo on TV',
      icon: '\uD83D\uDCF8',
      price: config?.photo.price ?? 5,
      enabled: config?.photo.enabled ?? false,
      color: 'from-amber-500 to-yellow-500',
    },
  ];

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-jb-text-primary">Special Features</h1>
        <p className="text-jb-text-secondary text-sm mt-1">
          Wallet: <span className="text-jb-accent-green font-semibold">{formatPrice(balance)}</span>
        </p>
      </div>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm text-center"
          >
            {successMessage}
          </motion.div>
        )}
        {(errorMessage || error) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm text-center"
          >
            {errorMessage || error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Grid */}
      <div className="grid grid-cols-2 gap-3">
        {events.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileTap={event.enabled ? { scale: 0.95 } : undefined}
            onClick={() => event.enabled && setActiveModal(event.id)}
            className={`relative overflow-hidden rounded-xl p-4 cursor-pointer transition-all ${
              event.enabled
                ? 'glass border border-white/10 hover:border-white/20'
                : 'bg-white/5 opacity-40 cursor-not-allowed'
            }`}
          >
            {/* Gradient accent */}
            <div className={`absolute inset-0 bg-gradient-to-br ${event.color} opacity-10`} />

            <div className="relative z-10">
              <div className="text-3xl mb-2">{event.icon}</div>
              <h3 className="text-sm font-semibold text-jb-text-primary">{event.name}</h3>
              <p className="text-xs text-jb-accent-green mt-1">
                {event.priceLabel || formatPrice(event.price)}
              </p>
              {!event.enabled && event.disabledReason && (
                <p className="text-xs text-jb-text-secondary mt-1">{event.disabledReason}</p>
              )}
              {!event.enabled && !event.disabledReason && (
                <p className="text-xs text-jb-text-secondary mt-1">Not available</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ============================================ */}
      {/* SILENCE MODAL */}
      {/* ============================================ */}
      <Modal isOpen={activeModal === 'silence'} onClose={() => setActiveModal(null)} title="Silence the Music">
        <div className="space-y-4">
          <p className="text-jb-text-secondary text-sm">Choose how long to silence the music:</p>
          <div className="space-y-2">
            {config?.silence.options.map((opt) => (
              <button
                key={opt.duration}
                onClick={() => setSelectedDuration(opt.duration)}
                className={`w-full p-3 rounded-lg border transition-all ${
                  selectedDuration === opt.duration
                    ? 'border-jb-accent-green bg-jb-accent-green/10 text-jb-text-primary'
                    : 'border-white/10 text-jb-text-secondary hover:border-white/20'
                }`}
              >
                <div className="flex justify-between">
                  <span>{opt.duration / 60} minute{opt.duration > 60 ? 's' : ''}</span>
                  <span className="text-jb-accent-green">{formatPrice(opt.price)}</span>
                </div>
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            fullWidth
            loading={isLoading}
            onClick={() => {
              if (!machineId) return;
              const opt = config?.silence.options.find((o) => o.duration === selectedDuration);
              handlePurchase(
                () => purchaseSilence(machineId, selectedDuration),
                `Silence activated for ${selectedDuration / 60} minute${selectedDuration > 60 ? 's' : ''}!`
              );
            }}
          >
            Buy Silence — {formatPrice(config?.silence.options.find((o) => o.duration === selectedDuration)?.price ?? 0)}
          </Button>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* TEXT MESSAGE MODAL */}
      {/* ============================================ */}
      <Modal isOpen={activeModal === 'textMessage'} onClose={() => setActiveModal(null)} title="Send Text to TV">
        <div className="space-y-4">
          <div>
            <textarea
              value={textMessage}
              onChange={(e) => setTextMessage(e.target.value.slice(0, config?.textMessage.maxLength ?? 200))}
              placeholder="Type your message..."
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-jb-text-primary placeholder-jb-text-secondary/50 resize-none h-24 focus:border-jb-accent-green focus:outline-none"
            />
            <p className="text-xs text-jb-text-secondary mt-1 text-right">
              {textMessage.length}/{config?.textMessage.maxLength ?? 200}
            </p>
          </div>
          <Button
            variant="primary"
            fullWidth
            loading={isLoading}
            disabled={!textMessage.trim()}
            onClick={() => {
              if (!machineId) return;
              handlePurchase(
                () => purchaseTextMessage(machineId, textMessage.trim()),
                'Message sent to TV!'
              );
              setTextMessage('');
            }}
          >
            Send Message — {formatPrice(config?.textMessage.price ?? 2)}
          </Button>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* REACTION MODAL */}
      {/* ============================================ */}
      <Modal isOpen={activeModal === 'reaction'} onClose={() => setActiveModal(null)} title="Send a Reaction">
        <div className="space-y-4">
          <p className="text-jb-text-secondary text-sm">Tap a reaction to send it to the TV!</p>
          <div className="grid grid-cols-5 gap-3">
            {(config?.reaction.types ?? []).map((type) => (
              <motion.button
                key={type}
                whileTap={{ scale: 0.8 }}
                onClick={() => {
                  if (!machineId) return;
                  handlePurchase(
                    () => purchaseReaction(machineId, type),
                    `${REACTION_EMOJIS[type] || type} sent!`
                  );
                }}
                className="flex flex-col items-center p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span className="text-3xl">{REACTION_EMOJIS[type] || type}</span>
                <span className="text-xs text-jb-text-secondary mt-1 capitalize">{type.toLowerCase()}</span>
              </motion.button>
            ))}
          </div>
          <p className="text-center text-xs text-jb-accent-green">
            {formatPrice(config?.reaction.price ?? 1)} each
          </p>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* BIRTHDAY MODAL */}
      {/* ============================================ */}
      <Modal isOpen={activeModal === 'birthday'} onClose={() => setActiveModal(null)} title="Birthday Celebration">
        <div className="space-y-4">
          <p className="text-jb-text-secondary text-sm">Celebrate someone's birthday on the big screen!</p>
          <input
            value={birthdayName}
            onChange={(e) => setBirthdayName(e.target.value)}
            placeholder="Birthday person's name"
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-jb-text-primary placeholder-jb-text-secondary/50 focus:border-jb-accent-green focus:outline-none"
          />
          <textarea
            value={birthdayMessage}
            onChange={(e) => setBirthdayMessage(e.target.value.slice(0, 200))}
            placeholder="Optional message (e.g., Happy Birthday from your friends!)"
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-jb-text-primary placeholder-jb-text-secondary/50 resize-none h-20 focus:border-jb-accent-green focus:outline-none"
          />
          <Button
            variant="primary"
            fullWidth
            loading={isLoading}
            disabled={!birthdayName.trim()}
            onClick={() => {
              if (!machineId) return;
              handlePurchase(
                () => purchaseBirthday(machineId, birthdayName.trim(), birthdayMessage.trim() || undefined),
                `Birthday celebration for ${birthdayName} is live!`
              );
              setBirthdayName('');
              setBirthdayMessage('');
            }}
          >
            Celebrate — {formatPrice(config?.birthday.price ?? 25)}
          </Button>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* SKIP QUEUE MODAL */}
      {/* ============================================ */}
      <Modal isOpen={activeModal === 'skipQueue'} onClose={() => setActiveModal(null)} title="Skip the Queue">
        <div className="space-y-4">
          <p className="text-jb-text-secondary text-sm">Move your song to the front of the queue!</p>
          {userQueueItems.length === 0 ? (
            <p className="text-jb-text-secondary text-center py-4">You have no songs in the queue</p>
          ) : (
            <div className="space-y-2">
              {userQueueItems.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedQueueItem(item.id)}
                  className={`w-full p-3 rounded-lg border transition-all text-left ${
                    selectedQueueItem === item.id
                      ? 'border-jb-accent-green bg-jb-accent-green/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <p className="text-jb-text-primary text-sm font-medium">{item.song?.title}</p>
                  <p className="text-jb-text-secondary text-xs">{item.song?.artist} — Position #{item.position}</p>
                </button>
              ))}
            </div>
          )}
          <Button
            variant="primary"
            fullWidth
            loading={isLoading}
            disabled={!selectedQueueItem}
            onClick={() => {
              if (!machineId || !selectedQueueItem) return;
              handlePurchase(
                () => purchaseSkipQueue(machineId, selectedQueueItem),
                'Your song has been moved to the front!'
              );
              setSelectedQueueItem('');
            }}
          >
            Skip Queue — {formatPrice(config?.skipQueue.price ?? 5)}
          </Button>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* VOICE MESSAGE MODAL (placeholder) */}
      {/* ============================================ */}
      <Modal isOpen={activeModal === 'voiceMessage'} onClose={() => setActiveModal(null)} title="Voice Message">
        <p className="text-jb-text-secondary text-sm mb-4">
          Record a voice message to play on the TV speakers. Requires bar owner approval.
        </p>
        <MediaCapture
          type="audio"
          maxDuration={config?.voiceMessage.options[0]?.duration === 5 ? 5 : 15}
          onCapture={(url, duration) => {
            handlePurchase(
              () => purchaseVoiceMessage(machineId!, url, duration || 5),
              'Voice message sent! Waiting for bar owner approval.'
            );
          }}
          onCancel={() => setActiveModal(null)}
        />
      </Modal>

      {/* ============================================ */}
      {/* PHOTO MODAL (placeholder) */}
      {/* ============================================ */}
      <Modal isOpen={activeModal === 'photo'} onClose={() => setActiveModal(null)} title="Photo on TV">
        <p className="text-jb-text-secondary text-sm mb-4">
          Take a photo to display on the TV screen. Requires bar owner approval.
        </p>
        <MediaCapture
          type="photo"
          onCapture={(url) => {
            handlePurchase(
              () => purchasePhoto(machineId!, url),
              'Photo sent! Waiting for bar owner approval.'
            );
          }}
          onCancel={() => setActiveModal(null)}
        />
      </Modal>
    </div>
  );
};
