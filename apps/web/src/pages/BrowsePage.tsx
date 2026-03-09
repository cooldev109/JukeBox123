import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchBar, SongCard, Button, Modal, Skeleton } from '@jukebox/ui';
import { useSongStore } from '../stores/songStore';
import { useQueueStore } from '../stores/queueStore';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatPrice = (reais: number): string => {
  return `R$ ${reais.toFixed(2)}`;
};

// Genre color mapping for filter chips
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
  Eletrônica: 'from-cyan-400 to-blue-600',
};

export const BrowsePage: React.FC = () => {
  const { songs, genres, isLoading, searchQuery, selectedGenre, fetchSongs, fetchGenres, setSearchQuery, setSelectedGenre } = useSongStore();
  const { addToQueue, machineId } = useQueueStore();
  const { balance, fetchWallet } = useWalletStore();
  const { user } = useAuthStore();

  const [selectedSong, setSelectedSong] = useState<typeof songs[0] | null>(null);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchGenres();
    fetchSongs();
    fetchWallet();
  }, []);

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
  }, [stopPreview]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleAddToQueue = async (isPriority: boolean = false) => {
    if (!selectedSong || !machineId) return;
    setAddingToQueue(true);
    try {
      await addToQueue(machineId, selectedSong.id, isPriority);
      setSelectedSong(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      fetchWallet(); // Refresh balance
    } catch {
      // Error handling
    } finally {
      setAddingToQueue(false);
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-jb-bg-primary/95 backdrop-blur-xl border-b border-white/5 px-4 pt-4 pb-3">
        <div className="max-w-6xl mx-auto">
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
                  price="R$ 2.00"
                  onClick={() => setSelectedSong(song)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Song Detail Modal */}
      <Modal
        isOpen={!!selectedSong}
        onClose={handleCloseModal}
        title={selectedSong?.title || ''}
      >
        {selectedSong && (
          <div className="space-y-4">
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
                {/* Play/Pause overlay */}
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

            <div className="border-t border-white/10 pt-4 space-y-3">
              <Button
                variant="primary"
                fullWidth
                loading={addingToQueue}
                onClick={() => handleAddToQueue(false)}
              >
                Add to Queue — R$ 2.00
              </Button>
              <Button
                variant="danger"
                fullWidth
                loading={addingToQueue}
                onClick={() => handleAddToQueue(true)}
              >
                VIP (Skip the Line) — R$ 5.00
              </Button>
            </div>

            <p className="text-center text-jb-text-secondary text-xs">
              Your balance: {formatPrice(balance)}
            </p>
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
