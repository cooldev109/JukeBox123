import React, { useEffect, useState, useRef } from 'react';
import { SearchBar, SongCard, Skeleton, Button, Modal, Input } from '@jukebox/ui';
import { useAdminStore } from '../../stores/adminStore';
import { api } from '../../lib/api';

const formatDuration = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

export const SongsAdminPage: React.FC = () => {
  const { songs, isLoading, fetchSongs } = useAdminStore();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSong, setNewSong] = useState({
    title: '',
    artist: '',
    album: '',
    genre: 'Pop',
    duration: 180,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSongs();
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSongs({ search: value }), 300);
  };

  const handleAddSong = async () => {
    setSaving(true);
    try {
      await api.post('/songs', newSong);
      setShowAddModal(false);
      setNewSong({
        title: '',
        artist: '',
        album: '',
        genre: 'Pop',
        duration: 180,
      });
      fetchSongs({ search });
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (songId: string) => {
    try {
      await api.delete(`/songs/${songId}`);
      fetchSongs({ search });
    } catch {
      // Handle error
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-jb-text-primary">Song Catalog</h2>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          Add Song
        </Button>
      </div>

      <div className="mb-4">
        <SearchBar
          value={search}
          onSearch={handleSearch}
          placeholder="Search songs..."
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="80px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : songs.length === 0 ? (
        <p className="text-jb-text-secondary text-center py-20">
          No songs found
        </p>
      ) : (
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
          {songs.map((song) => (
            <div key={song.id} className="relative group">
              <SongCard
                title={song.title}
                artist={song.artist}
                duration={formatDuration(song.duration)}
              />
              <button
                onClick={() => handleDelete(song.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-jb-highlight-pink/20 rounded-full p-1.5 hover:bg-jb-highlight-pink/40"
              >
                <svg
                  className="w-4 h-4 text-jb-highlight-pink"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Song Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Song"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={newSong.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewSong({ ...newSong, title: e.target.value })
            }
          />
          <Input
            label="Artist"
            value={newSong.artist}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewSong({ ...newSong, artist: e.target.value })
            }
          />
          <Input
            label="Album"
            value={newSong.album}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewSong({ ...newSong, album: e.target.value })
            }
          />
          <Input
            label="Genre"
            value={newSong.genre}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewSong({ ...newSong, genre: e.target.value })
            }
          />
          <Input
            label="Duration (seconds)"
            type="number"
            value={String(newSong.duration)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewSong({
                ...newSong,
                duration: parseInt(e.target.value) || 0,
              })
            }
          />
          <Button
            variant="primary"
            fullWidth
            loading={saving}
            onClick={handleAddSong}
          >
            Add Song
          </Button>
        </div>
      </Modal>
    </div>
  );
};
