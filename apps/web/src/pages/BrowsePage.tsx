import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchBar, SongCard, Button, Modal, Skeleton, Input } from '@jukebox/ui';
import { useSongStore } from '../stores/songStore';
import { SongDiscoverBot } from '../components/SongDiscoverBot';
import { StripeCardForm } from '../components/StripeCardForm';
import { useQueueStore } from '../stores/queueStore';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatPrice = (reais: number): string => `R$ ${reais.toFixed(2)}`;

const genreColors: Record<string, string> = {
  Sertanejo: 'from-yellow-600 to-orange-600',
  Rock: 'from-red-600 to-red-800',
  Pop: 'from-pink-500 to-purple-600',
  Funk: 'from-green-500 to-teal-600',
  Samba: 'from-yellow-500 to-green-600',
  MPB: 'from-blue-500 to-indigo-600',
  'Bossa Nova': 'from-teal-400 to-cyan-600',
  Forró: 'from-orange-500 to-red-500',
  Pagode: 'from-purple-500 to-pink-500',
  'Eletrônica': 'from-cyan-400 to-blue-600',
};

const SONG_PRICE = 2.0;
const VIP_PRICE = 5.0;

export const BrowsePage: React.FC = () => {
  const { songs, genres, isLoading, searchQuery, selectedGenre, fetchSongs, fetchGenres, setSearchQuery, setSelectedGenre } = useSongStore();
  const { machineId, setMachineId } = useQueueStore();
  const { balance, fetchWallet, generatePixForSong, pollPixStatus, simulatePixPayment, spendFromWallet, clearPix, pixPayment, pixStatus, isSandbox, checkProvider } = useWalletStore();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [selectedSong, setSelectedSong] = useState<typeof songs[0] | null>(null);
  const [venueCode, setVenueCode] = useState('');
  const [connectingVenue, setConnectingVenue] = useState(false);
  const [venueError, setVenueError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [copied, setCopied] = useState(false);

  // Payment flow state
  const [paymentStep, setPaymentStep] = useState<'choose' | 'pix-pending' | 'card-pending' | 'completed' | 'failed'>('choose');
  const [selectedPayMethod, setSelectedPayMethod] = useState<'wallet' | 'pix' | 'card'>('wallet');
  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);
  const [cardPayAmount, setCardPayAmount] = useState(0);
  const [cardTransactionId, setCardTransactionId] = useState<string | null>(null);
  const [pendingPriority, setPendingPriority] = useState(false);

  // Discover (external search) state
  const [discoverResults, setDiscoverResults] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [addingSong, setAddingSong] = useState<string | null>(null);
  const [showBot, setShowBot] = useState(false);
  const [showVenueConnect, setShowVenueConnect] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchGenres();
    fetchSongs();
    fetchWallet();
    checkProvider();

    // Auto-connect if venue code is in URL (e.g., /browse?venue=BAR-CARLOS)
    const venueFromUrl = searchParams.get('venue');
    if (venueFromUrl && !machineId) {
      setVenueCode(venueFromUrl);
      autoConnectVenue(venueFromUrl);
    }
  }, []);

  const autoConnectVenue = async (code: string) => {
    setConnectingVenue(true);
    setVenueError('');
    try {
      const { data } = await api.post('/auth/connect-venue', { venueCode: code.trim().toUpperCase() });
      const machine = data.data?.machine;
      if (!machine) { setVenueError('No machines available at this venue'); return; }
      setMachineId(machine.id);
      localStorage.setItem('jb_machine_id', machine.id);
      setVenueCode('');
      // Remove venue param from URL after connecting
      searchParams.delete('venue');
      setSearchParams(searchParams, { replace: true });
    } catch (err: any) {
      setVenueError(err.response?.data?.error || 'Venue not found');
    } finally {
      setConnectingVenue(false);
    }
  };

  // Debounced search
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSongs({ search: value });
    }, 300);
  }, [fetchSongs, setSearchQuery]);

  const handleGenreFilter = (genre: string | null) => {
    setSelectedGenre(genre);
    fetchSongs({ genre: genre ?? undefined, search: searchQuery });
  };

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsPreviewPlaying(false);
  }, []);

  const togglePreview = useCallback((fileUrl: string) => {
    if (isPreviewPlaying) {
      stopPreview();
    } else {
      if (!audioRef.current) {
        audioRef.current = new window.Audio();
        audioRef.current.addEventListener('ended', () => setIsPreviewPlaying(false));
      }
      audioRef.current.src = fileUrl;
      audioRef.current.play().catch(() => {});
      setIsPreviewPlaying(true);
    }
  }, [isPreviewPlaying, stopPreview]);

  const handleCloseModal = useCallback(() => {
    stopPreview();
    setSelectedSong(null);
    setQueueError('');
    setPaymentStep('choose');
    clearPix();
    setCardClientSecret(null);
    clearInterval(pollRef.current);
  }, [stopPreview, clearPix]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      clearInterval(pollRef.current);
    };
  }, []);

  // Start Pix polling when in pix-pending state
  useEffect(() => {
    if (paymentStep === 'pix-pending' && pixPayment?.transactionId) {
      pollRef.current = setInterval(async () => {
        try {
          const status = await pollPixStatus(pixPayment.transactionId);
          if (status === 'COMPLETED') {
            clearInterval(pollRef.current);
            setPaymentStep('completed');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            fetchWallet();
          } else if (status === 'FAILED') {
            clearInterval(pollRef.current);
            setPaymentStep('failed');
          }
        } catch {
          // continue polling
        }
      }, 3000);

      return () => clearInterval(pollRef.current);
    }
  }, [paymentStep, pixPayment?.transactionId]);

  // Pay with Wallet
  const handleWalletPayment = async (isPriority: boolean) => {
    if (!selectedSong || !machineId) return;
    const price = isPriority ? VIP_PRICE : SONG_PRICE;

    if (balance < price) {
      setQueueError(`Insufficient balance. You have ${formatPrice(balance)} but need ${formatPrice(price)}. Top up your wallet first.`);
      return;
    }

    setProcessing(true);
    setQueueError('');
    try {
      await spendFromWallet(
        price,
        isPriority ? 'SKIP_QUEUE' : 'SONG_PAYMENT',
        machineId,
        selectedSong.id,
        isPriority,
      );
      setPaymentStep('completed');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        handleCloseModal();
      }, 2000);
      fetchWallet();
    } catch (err: any) {
      setQueueError(err.response?.data?.error || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  // Pay with Pix (direct)
  const handlePixPayment = async (isPriority: boolean) => {
    if (!selectedSong || !machineId) return;
    const price = isPriority ? VIP_PRICE : SONG_PRICE;

    setProcessing(true);
    setQueueError('');
    setPendingPriority(isPriority);
    try {
      await generatePixForSong(
        price,
        machineId,
        selectedSong.id,
        isPriority ? 'SKIP_QUEUE' : 'SONG_PAYMENT',
      );
      setPaymentStep('pix-pending');
    } catch (err: any) {
      setQueueError(err.response?.data?.error || 'Failed to generate Pix payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleCardPayment = async (isPriority: boolean) => {
    if (!selectedSong || !machineId) return;
    setProcessing(true);
    const amount = isPriority ? VIP_PRICE : SONG_PRICE;
    setPendingPriority(isPriority);
    setCardPayAmount(amount);
    try {
      const { data } = await api.post('/payments/card', {
        amount,
        type: isPriority ? 'SKIP_QUEUE' : 'SONG_PAYMENT',
        machineId,
        songId: selectedSong.id,
      });
      setCardClientSecret(data.data.clientSecret);
      setCardTransactionId(data.data.transactionId);
      setPaymentStep('card-pending' as any);
    } catch (err: any) {
      setQueueError(err.response?.data?.error || 'Card payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayment = (isPriority: boolean) => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/browse');
      return;
    }
    if (!machineId) {
      setShowVenueConnect(true);
      return;
    }
    if (selectedPayMethod === 'wallet') {
      handleWalletPayment(isPriority);
    } else if (selectedPayMethod === 'card') {
      handleCardPayment(isPriority);
    } else {
      handlePixPayment(isPriority);
    }
  };

  const handleCopyPix = async () => {
    if (!pixPayment?.pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(pixPayment.pixCopiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = pixPayment.pixCopiaECola;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSimulate = async () => {
    if (!pixPayment?.transactionId) return;
    try {
      await simulatePixPayment(pixPayment.transactionId);
      clearInterval(pollRef.current);
      setPaymentStep('completed');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        handleCloseModal();
      }, 2000);
      fetchWallet();
    } catch {
      setQueueError('Simulation failed');
    }
  };

  const handleDiscover = async (query: string) => {
    if (!query.trim()) return;
    setDiscoverLoading(true);
    setDiscoverQuery(query);
    setDiscoverResults([]);
    try {
      const { data } = await api.get('/catalog/discover', { params: { query: query.trim(), limit: 10 } });
      setDiscoverResults(data.data?.songs || []);
    } catch {
      setDiscoverResults([]);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleAddFromSource = async (song: any) => {
    setAddingSong(song.title);
    try {
      const { data } = await api.post('/catalog/add-from-source', {
        title: song.title,
        artist: song.artist,
        album: song.album || undefined,
        genre: song.genre,
        duration: song.duration,
        fileUrl: song.fileUrl,
        coverArtUrl: song.coverArtUrl || undefined,
        format: song.format || 'MP3',
        fileSize: song.fileSize || 0,
      });
      if (data.success) {
        // Refresh catalog so the song appears
        await fetchSongs();
        setDiscoverResults([]);
        setDiscoverQuery('');
      }
    } catch {
      setQueueError('Failed to add song');
    } finally {
      setAddingSong(null);
    }
  };

  const handleConnectVenue = async () => {
    if (!venueCode.trim()) { setVenueError('Enter the venue code'); return; }
    setConnectingVenue(true);
    setVenueError('');
    try {
      const { data } = await api.post('/auth/connect-venue', { venueCode: venueCode.trim().toUpperCase() });
      const machine = data.data?.machine;
      if (!machine) { setVenueError('No machines available at this venue'); return; }
      setMachineId(machine.id);
      localStorage.setItem('jb_machine_id', machine.id);
      setVenueCode('');
    } catch (err: any) {
      setVenueError(err.response?.data?.error || 'Venue not found');
    } finally {
      setConnectingVenue(false);
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary pb-24">
      {/* Venue connection banner — only shown when trying to pay without connection */}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-jb-bg-primary/95 backdrop-blur-xl border-b border-white/5 px-4 pt-2 pb-3">
        <div className="max-w-6xl mx-auto">
          {/* Top bar with logo and login */}
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-jb-accent-green neon-text-green">JukeBox</h1>
            {!isAuthenticated ? (
              <button
                onClick={() => navigate('/login?redirect=/browse')}
                className="px-4 py-1.5 rounded-full text-sm font-medium bg-jb-accent-green text-jb-bg-primary hover:opacity-90 transition-all"
              >
                Login / Register
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-jb-text-secondary text-xs">{user?.name}</span>
                <div className="w-7 h-7 rounded-full bg-jb-accent-purple/30 flex items-center justify-center text-jb-accent-purple text-xs font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </div>
            )}
          </div>

          <SearchBar
            value={searchQuery}
            onSearch={handleSearch}
            placeholder="Search songs, artists, albums..."
          />

          {/* Genre Chips */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => handleGenreFilter(null)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                !selectedGenre
                  ? 'bg-jb-accent-green text-jb-bg-primary'
                  : 'bg-white/5 text-jb-text-secondary hover:bg-white/10'
              }`}
            >
              All
            </button>
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenreFilter(genre === selectedGenre ? null : genre)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedGenre === genre
                    ? `bg-gradient-to-r ${genreColors[genre] || 'from-purple-500 to-pink-500'} text-white`
                    : 'bg-white/5 text-jb-text-secondary hover:bg-white/10'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Songs Grid */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        {isLoading ? (
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎵</div>
            <h3 className="text-xl font-bold text-jb-text-primary mb-2">No songs found</h3>
            <p className="text-jb-text-secondary">Try a different search or genre</p>
            {searchQuery && (
              <button
                onClick={() => handleDiscover(searchQuery)}
                className="mt-4 px-6 py-2 bg-jb-accent-purple text-white rounded-full font-medium hover:opacity-90 transition-all"
              >
                Search "{searchQuery}" on Internet Archive
              </button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.03 } },
            }}
          >
            {songs.map((song) => (
              <motion.div
                key={song.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <SongCard
                  title={song.title}
                  artist={song.artist}
                  coverArtUrl={song.coverArtUrl}
                  duration={formatDuration(song.duration)}
                  price={formatPrice(SONG_PRICE)}
                  onClick={() => {
                    setSelectedSong(song);
                    setPaymentStep('choose');
                    setQueueError('');
                    clearPix();
                  }}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Discover Section — search external sources */}
      {(discoverResults.length > 0 || discoverLoading) && (
        <div className="max-w-6xl mx-auto px-4 mt-6">
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-lg font-bold text-jb-accent-purple mb-3">
              Results from Internet Archive: "{discoverQuery}"
            </h3>
            {discoverLoading ? (
              <div className="flex items-center gap-3 py-8 justify-center">
                <div className="w-6 h-6 border-2 border-jb-accent-purple border-t-transparent rounded-full animate-spin" />
                <p className="text-jb-text-secondary">Searching external sources...</p>
              </div>
            ) : discoverResults.length === 0 ? (
              <p className="text-jb-text-secondary py-4">No results found on external sources.</p>
            ) : (
              <div className="space-y-2">
                {discoverResults.map((song: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-jb-bg-secondary/50 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {song.coverArtUrl ? (
                        <img src={song.coverArtUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-jb-bg-primary flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-jb-accent-purple" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-jb-text-primary font-medium text-sm truncate">{song.title}</p>
                        <p className="text-jb-text-secondary text-xs truncate">{song.artist}</p>
                        <p className="text-jb-text-secondary/60 text-xs">{song.genre} · {formatDuration(song.duration)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddFromSource(song)}
                      disabled={addingSong === song.title}
                      className="flex-shrink-0 ml-3 px-4 py-2 bg-jb-accent-green text-jb-bg-primary rounded-full text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {addingSong === song.title ? 'Adding...' : '+ Add'}
                    </button>
                  </div>
                ))}
                <p className="text-jb-text-secondary/40 text-xs text-center pt-2">
                  Songs from Internet Archive (free/open source music)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Song Finder Bot - Floating Button */}
      <button
        onClick={() => setShowBot(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-gradient-to-r from-jb-accent-purple to-jb-highlight-pink rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        title="Find a song"
      >
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </button>

      {/* Song Finder Bot - Chat Modal */}
      <AnimatePresence>
        {showBot && <SongDiscoverBot onClose={() => setShowBot(false)} />}
      </AnimatePresence>

      {/* Song Detail Modal */}
      <Modal
        isOpen={!!selectedSong}
        onClose={handleCloseModal}
        title={selectedSong?.title || ''}
      >
        {selectedSong && (
          <div className="space-y-4">
            {/* Song Info */}
            <div className="flex items-center gap-4">
              <div
                className="w-24 h-24 rounded-xl overflow-hidden bg-jb-bg-secondary flex-shrink-0 relative cursor-pointer group"
                onClick={() => togglePreview(selectedSong.fileUrl)}
              >
                {selectedSong.coverArtUrl ? (
                  <img src={selectedSong.coverArtUrl} alt={selectedSong.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-jb-accent-purple" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
                <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isPreviewPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    {isPreviewPlaying ? (
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    ) : (
                      <path d="M8 5v14l11-7z" />
                    )}
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-jb-text-primary">{selectedSong.title}</h3>
                <p className="text-jb-text-secondary">{selectedSong.artist}</p>
                {selectedSong.album && <p className="text-jb-text-secondary/60 text-sm">{selectedSong.album}</p>}
                <p className="text-jb-text-secondary/60 text-sm mt-1">
                  {selectedSong.genre} · {formatDuration(selectedSong.duration)}
                </p>
                <p className="text-jb-accent-purple text-xs mt-1 cursor-pointer" onClick={() => togglePreview(selectedSong.fileUrl)}>
                  {isPreviewPlaying ? 'Pause preview' : 'Tap to preview'}
                </p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              {/* === CHOOSE PAYMENT METHOD === */}
              {paymentStep === 'choose' && (
                <div className="space-y-3">
                  {/* Payment method toggle */}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setSelectedPayMethod('wallet')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        selectedPayMethod === 'wallet'
                          ? 'bg-jb-accent-green text-jb-bg-primary'
                          : 'bg-white/5 text-jb-text-secondary hover:bg-white/10'
                      }`}
                    >
                      Wallet ({formatPrice(balance)})
                    </button>
                    <button
                      onClick={() => setSelectedPayMethod('pix')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        selectedPayMethod === 'pix'
                          ? 'bg-jb-accent-green text-jb-bg-primary'
                          : 'bg-white/5 text-jb-text-secondary hover:bg-white/10'
                      }`}
                    >
                      Pix
                    </button>
                    <button
                      onClick={() => setSelectedPayMethod('card')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        selectedPayMethod === 'card'
                          ? 'bg-jb-accent-purple text-white'
                          : 'bg-white/5 text-jb-text-secondary hover:bg-white/10'
                      }`}
                    >
                      Card
                    </button>
                  </div>

                  {selectedPayMethod === 'wallet' && balance < SONG_PRICE && (
                    <p className="text-yellow-400 text-xs text-center">
                      Low balance — top up in the Wallet tab or switch to Pix
                    </p>
                  )}

                  <Button
                    variant="primary"
                    fullWidth
                    loading={processing}
                    onClick={() => handlePayment(false)}
                  >
                    Add to Queue — {formatPrice(SONG_PRICE)}
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    loading={processing}
                    onClick={() => handlePayment(true)}
                  >
                    VIP (Skip the Line) — {formatPrice(VIP_PRICE)}
                  </Button>
                </div>
              )}

              {/* === PIX PENDING === */}
              {paymentStep === 'pix-pending' && pixPayment && (
                <div className="space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="bg-white p-2 rounded-xl">
                      <img
                        src={pixPayment.qrCodeBase64}
                        alt="Pix QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>

                  {/* Amount & Status */}
                  <div className="text-center">
                    <p className="text-jb-accent-green font-bold text-lg">
                      {formatPrice(pixPayment.amount)}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                      <p className="text-yellow-400 text-sm">Waiting for payment...</p>
                    </div>
                  </div>

                  {/* Copia e Cola */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                    <p className="text-jb-text-primary text-xs font-mono break-all">
                      {pixPayment.pixCopiaECola.length > 80
                        ? pixPayment.pixCopiaECola.slice(0, 80) + '...'
                        : pixPayment.pixCopiaECola}
                    </p>
                  </div>

                  <Button variant="primary" fullWidth onClick={handleCopyPix}>
                    {copied ? 'Copied!' : 'Copy Pix Code'}
                  </Button>

                  {isSandbox && (
                    <Button
                      variant="ghost"
                      fullWidth
                      onClick={handleSimulate}
                      className="border border-yellow-500/30 text-yellow-400"
                    >
                      [SANDBOX] Simulate Payment
                    </Button>
                  )}

                  <p className="text-jb-text-secondary text-xs text-center">
                    Open your bank app, select Pix, paste the code. Song is added automatically after payment.
                  </p>

                  <Button variant="ghost" fullWidth onClick={() => {
                    clearInterval(pollRef.current);
                    clearPix();
                    setPaymentStep('choose');
                  }}>
                    Cancel
                  </Button>
                </div>
              )}

              {/* === CARD PENDING === */}
              {paymentStep === 'card-pending' && cardClientSecret && (
                <StripeCardForm
                  clientSecret={cardClientSecret}
                  amount={cardPayAmount}
                  transactionId={cardTransactionId || undefined}
                  onSuccess={() => {
                    setCardClientSecret(null);
                    setPaymentStep('completed');
                    setShowSuccess(true);
                    fetchWallet();
                    setTimeout(() => {
                      setShowSuccess(false);
                      handleCloseModal();
                    }, 2000);
                  }}
                  onCancel={() => {
                    setCardClientSecret(null);
                    setPaymentStep('choose');
                  }}
                />
              )}

              {/* === COMPLETED === */}
              {paymentStep === 'completed' && (
                <div className="text-center py-4 space-y-3">
                  <div className="w-14 h-14 mx-auto bg-jb-accent-green/20 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-jb-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-jb-accent-green font-bold text-lg">Song Added to Queue!</p>
                  <p className="text-jb-text-secondary text-sm">
                    {pendingPriority ? 'Your song has been prioritized' : 'Your song will play soon'}
                  </p>
                  <Button variant="primary" onClick={handleCloseModal}>
                    Done
                  </Button>
                </div>
              )}

              {/* === FAILED === */}
              {paymentStep === 'failed' && (
                <div className="text-center py-4 space-y-3">
                  <div className="w-14 h-14 mx-auto bg-jb-highlight-pink/20 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-jb-highlight-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-jb-highlight-pink font-bold">Payment Failed</p>
                  <p className="text-jb-text-secondary text-sm">The payment expired or was declined.</p>
                  <Button variant="primary" onClick={() => { clearPix(); setPaymentStep('choose'); }}>
                    Try Again
                  </Button>
                </div>
              )}
            </div>

            {queueError && <p className="text-center text-jb-highlight-pink text-sm">{queueError}</p>}
          </div>
        )}
      </Modal>

      {/* Success toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-50 bg-jb-accent-green/20 border border-jb-accent-green/40 rounded-xl p-4 text-center"
          >
            <p className="text-jb-accent-green font-bold">Song added to queue!</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
