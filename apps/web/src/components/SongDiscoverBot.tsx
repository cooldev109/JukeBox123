import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { useSongStore } from '../stores/songStore';

interface BotMessage {
  id: string;
  type: 'user' | 'bot' | 'results' | 'success' | 'error';
  text?: string;
  results?: any[];
  timestamp: Date;
}

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const SongDiscoverBot: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: 'welcome',
      type: 'bot',
      text: "Hi! I can find songs for you. Type a song name, artist, or genre and I'll search for it.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [addingSong, setAddingSong] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { fetchSongs } = useSongStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addMessage = (msg: Omit<BotMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now().toString(), timestamp: new Date() }]);
  };

  const handleSearch = async () => {
    const query = input.trim();
    if (!query || isSearching) return;

    setInput('');
    addMessage({ type: 'user', text: query });
    setIsSearching(true);

    // First check catalog
    addMessage({ type: 'bot', text: `Searching for "${query}"...` });

    try {
      // Search in catalog first
      const catalogRes = await api.get('/songs', { params: { query, limit: 5 } });
      const catalogSongs = catalogRes.data.data?.songs || [];

      if (catalogSongs.length > 0) {
        addMessage({
          type: 'bot',
          text: `Found ${catalogSongs.length} song${catalogSongs.length > 1 ? 's' : ''} in our catalog:`,
        });
        addMessage({
          type: 'results',
          results: catalogSongs.map((s: any) => ({ ...s, inCatalog: true })),
        });
      }

      // Then search external sources
      const discoverRes = await api.get('/catalog/discover', { params: { query, limit: 10 } });
      const externalSongs = discoverRes.data.data?.songs || [];

      // Filter out songs already in catalog
      const newSongs = externalSongs.filter(
        (ext: any) => !catalogSongs.some((cat: any) =>
          cat.title.toLowerCase() === ext.title.toLowerCase() &&
          cat.artist.toLowerCase() === ext.artist.toLowerCase()
        )
      );

      if (newSongs.length > 0) {
        addMessage({
          type: 'bot',
          text: `I also found ${newSongs.length} song${newSongs.length > 1 ? 's' : ''} from Internet Archive that can be added:`,
        });
        addMessage({
          type: 'results',
          results: newSongs.map((s: any) => ({ ...s, inCatalog: false })),
        });
      } else if (catalogSongs.length === 0) {
        addMessage({
          type: 'bot',
          text: `Sorry, I couldn't find any songs matching "${query}". Try a different name or spelling.`,
        });
      }
    } catch {
      addMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSong = async (song: any) => {
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
        addMessage({
          type: 'success',
          text: `"${song.title}" by ${song.artist} has been added to the catalog! You can now find it in the song list and order it.`,
        });
        fetchSongs();
      }
    } catch {
      addMessage({ type: 'error', text: `Failed to add "${song.title}". Please try again.` });
    } finally {
      setAddingSong(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Chat Window */}
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="relative w-full sm:max-w-lg sm:mx-4 h-[85vh] sm:h-[70vh] bg-jb-bg-primary border border-white/10 sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-jb-accent-purple/20 to-jb-highlight-pink/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-jb-accent-purple/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-jb-accent-purple" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <div>
              <h3 className="text-jb-text-primary font-bold text-sm">Song Finder</h3>
              <p className="text-jb-text-secondary text-xs">Search & add songs to catalog</p>
            </div>
          </div>
          <button onClick={onClose} className="text-jb-text-secondary hover:text-jb-text-primary p-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.type === 'user' ? (
                  <div className="max-w-[80%] bg-jb-accent-purple/30 text-jb-text-primary rounded-2xl rounded-br-md px-4 py-2 text-sm">
                    {msg.text}
                  </div>
                ) : msg.type === 'results' ? (
                  <div className="w-full space-y-2">
                    {msg.results?.map((song: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 bg-jb-bg-secondary/50 rounded-xl p-2.5 border border-white/5"
                      >
                        {song.coverArtUrl ? (
                          <img src={song.coverArtUrl} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-jb-bg-primary flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-jb-accent-purple" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-jb-text-primary font-medium text-xs truncate">{song.title}</p>
                          <p className="text-jb-text-secondary text-xs truncate">{song.artist}</p>
                          <p className="text-jb-text-secondary/50 text-xs">{song.genre} · {formatDuration(song.duration)}</p>
                        </div>
                        {song.inCatalog ? (
                          <span className="flex-shrink-0 px-3 py-1.5 bg-jb-accent-green/10 text-jb-accent-green rounded-full text-xs font-medium">
                            In catalog
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddSong(song)}
                            disabled={addingSong === song.title}
                            className="flex-shrink-0 px-3 py-1.5 bg-jb-accent-green text-jb-bg-primary rounded-full text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {addingSong === song.title ? (
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 border-2 border-jb-bg-primary border-t-transparent rounded-full animate-spin" />
                                Adding
                              </span>
                            ) : '+ Add'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : msg.type === 'success' ? (
                  <div className="max-w-[85%] bg-jb-accent-green/10 border border-jb-accent-green/20 text-jb-accent-green rounded-2xl rounded-bl-md px-4 py-2 text-sm flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {msg.text}
                  </div>
                ) : msg.type === 'error' ? (
                  <div className="max-w-[85%] bg-jb-highlight-pink/10 border border-jb-highlight-pink/20 text-jb-highlight-pink rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                    {msg.text}
                  </div>
                ) : (
                  <div className="max-w-[85%] bg-jb-bg-secondary/80 text-jb-text-primary rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                    {msg.text}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isSearching && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-jb-bg-secondary/80 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-jb-accent-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-jb-accent-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-jb-accent-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/10 bg-jb-bg-primary">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a song name or artist..."
              disabled={isSearching}
              className="flex-1 bg-jb-bg-secondary border border-white/10 rounded-full px-4 py-2.5 text-sm text-jb-text-primary placeholder-jb-text-secondary/50 focus:outline-none focus:border-jb-accent-purple transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSearch}
              disabled={!input.trim() || isSearching}
              className="w-10 h-10 bg-jb-accent-purple rounded-full flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-30 flex-shrink-0"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
