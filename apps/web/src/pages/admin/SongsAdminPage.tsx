import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SearchBar, SongCard, Skeleton, Button, Modal, Input, Card } from '@jukebox/ui';
import { useAdminStore } from '../../stores/adminStore';
import { api } from '../../lib/api';

const formatDuration = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

type CatalogView = 'genres' | 'artists' | 'albums' | 'songs' | 'flat';

interface Genre { id: string; name: string; coverArtUrl?: string; sortOrder?: number; isActive: boolean; _count?: { artists: number } }
interface Artist { id: string; name: string; genreId: string; coverArtUrl?: string; isActive: boolean; _count?: { albums: number } }
interface Album { id: string; name: string; artistId: string; coverArtUrl?: string; year?: number; isActive: boolean; _count?: { songs: number } }
interface CatalogSong { id: string; title: string; artist: string; album: string; genre: string; duration: number; trackNumber?: number; isActive: boolean }

export const SongsAdminPage: React.FC = () => {
  const { songs, isLoading: flatLoading, fetchSongs } = useAdminStore();

  // Catalog navigation state
  const [view, setView] = useState<CatalogView>('genres');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [catalogSongs, setCatalogSongs] = useState<CatalogSong[]>([]);
  const [loading, setLoading] = useState(false);

  // Breadcrumb state
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  // Flat song search
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Modals
  const [showAddGenre, setShowAddGenre] = useState(false);
  const [showAddArtist, setShowAddArtist] = useState(false);
  const [showAddAlbum, setShowAddAlbum] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ title: '', artist: '', album: '', genre: 'Pop' });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [genreForm, setGenreForm] = useState({ name: '', sortOrder: 0 });
  const [artistForm, setArtistForm] = useState({ name: '' });
  const [albumForm, setAlbumForm] = useState({ name: '', year: new Date().getFullYear() });
  const [songForm, setSongForm] = useState({ title: '', artist: '', album: '', genre: 'Pop', duration: 180 });
  const [batchForm, setBatchForm] = useState({ genre: '', artist: '', album: '', songs: '' });

  // Load genres on mount
  useEffect(() => { loadGenres(); }, []);

  const loadGenres = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/catalog/genres');
      setGenres(data.data?.genres || []);
    } catch { /* */ }
    setLoading(false);
  };

  const loadArtists = async (genre: Genre) => {
    setSelectedGenre(genre);
    setSelectedArtist(null);
    setSelectedAlbum(null);
    setView('artists');
    setLoading(true);
    try {
      const { data } = await api.get(`/catalog/genres/${genre.id}/artists`);
      setArtists(data.data?.artists || []);
    } catch { /* */ }
    setLoading(false);
  };

  const loadAlbums = async (artist: Artist) => {
    setSelectedArtist(artist);
    setSelectedAlbum(null);
    setView('albums');
    setLoading(true);
    try {
      const { data } = await api.get(`/catalog/artists/${artist.id}/albums`);
      setAlbums(data.data?.albums || []);
    } catch { /* */ }
    setLoading(false);
  };

  const loadAlbumSongs = async (album: Album) => {
    setSelectedAlbum(album);
    setView('songs');
    setLoading(true);
    try {
      const { data } = await api.get(`/catalog/albums/${album.id}/songs`);
      setCatalogSongs(data.data?.songs || []);
    } catch { /* */ }
    setLoading(false);
  };

  const goToFlat = () => {
    setView('flat');
    fetchSongs({ search });
  };

  // Breadcrumb navigation
  const goToGenres = () => {
    setView('genres');
    setSelectedGenre(null);
    setSelectedArtist(null);
    setSelectedAlbum(null);
    loadGenres();
  };

  const goToArtists = () => {
    if (selectedGenre) loadArtists(selectedGenre);
  };

  const goToAlbums = () => {
    if (selectedArtist) loadAlbums(selectedArtist);
  };

  // Flat search
  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSongs({ search: value }), 300);
  };

  // CRUD handlers
  const handleAddGenre = async () => {
    setSaving(true); setFormError('');
    try {
      await api.post('/catalog/genres', genreForm);
      setShowAddGenre(false);
      setGenreForm({ name: '', sortOrder: 0 });
      loadGenres();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create genre');
    }
    setSaving(false);
  };

  const handleAddArtist = async () => {
    if (!selectedGenre) return;
    setSaving(true); setFormError('');
    try {
      await api.post('/catalog/artists', { ...artistForm, genreId: selectedGenre.id });
      setShowAddArtist(false);
      setArtistForm({ name: '' });
      loadArtists(selectedGenre);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create artist');
    }
    setSaving(false);
  };

  const handleAddAlbum = async () => {
    if (!selectedArtist) return;
    setSaving(true); setFormError('');
    try {
      await api.post('/catalog/albums', { ...albumForm, artistId: selectedArtist.id });
      setShowAddAlbum(false);
      setAlbumForm({ name: '', year: new Date().getFullYear() });
      loadAlbums(selectedArtist);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create album');
    }
    setSaving(false);
  };

  const handleAddSong = async () => {
    setSaving(true); setFormError('');
    try {
      await api.post('/songs', songForm);
      setShowAddSong(false);
      setSongForm({ title: '', artist: '', album: '', genre: 'Pop', duration: 180 });
      if (view === 'flat') fetchSongs({ search });
      else if (selectedAlbum) loadAlbumSongs(selectedAlbum);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to add song');
    }
    setSaving(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setFormError('File too large. Maximum 50MB.');
      return;
    }
    if (!file.type.includes('audio') && !file.name.toLowerCase().endsWith('.mp3')) {
      setFormError('Please select an MP3 file.');
      return;
    }
    setFormError('');
    setUploadFile(file);
    // Auto-fill title from filename
    const filename = file.name.replace(/\.[^/.]+$/, '');
    setUploadForm(p => ({ ...p, title: p.title || filename }));
  };

  const handleUploadSong = async () => {
    if (!uploadFile) { setFormError('Please select a file'); return; }
    if (!uploadForm.title.trim() || !uploadForm.artist.trim()) {
      setFormError('Title and artist are required');
      return;
    }
    setUploading(true);
    setFormError('');
    setUploadProgress(0);

    try {
      const reader = new window.FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 50));
          }
        };
      });
      reader.readAsDataURL(uploadFile);
      const base64 = await base64Promise;

      setUploadProgress(60);
      await api.post('/songs/upload', {
        file: base64,
        title: uploadForm.title,
        artist: uploadForm.artist,
        album: uploadForm.album || undefined,
        genre: uploadForm.genre,
      });
      setUploadProgress(100);

      setTimeout(() => {
        setShowUpload(false);
        setUploadFile(null);
        setUploadForm({ title: '', artist: '', album: '', genre: 'Pop' });
        setUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (view === 'flat') fetchSongs({ search });
        else if (selectedAlbum) loadAlbumSongs(selectedAlbum);
      }, 500);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Upload failed');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleBatchImport = async () => {
    setSaving(true); setFormError('');
    try {
      const songLines = batchForm.songs.split('\n').filter(l => l.trim());
      const songs = songLines.map((line, i) => ({
        title: line.trim(),
        trackNumber: i + 1,
        fileUrl: `https://placeholder.com/${encodeURIComponent(line.trim())}.mp3`,
        duration: 200,
        fileSize: 0,
        format: 'MP3' as const,
      }));

      const { data } = await api.post('/catalog/batch-import', {
        genre: batchForm.genre,
        artist: batchForm.artist,
        album: batchForm.album,
        songs,
      });

      setShowBatchImport(false);
      setBatchForm({ genre: '', artist: '', album: '', songs: '' });
      window.alert(`Imported ${data.data.imported} songs, skipped ${data.data.skipped} duplicates`);
      loadGenres();
      setView('genres');
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to batch import');
    }
    setSaving(false);
  };

  const handleDeleteGenre = async (id: string) => {
    if (!window.confirm('Deactivate this genre?')) return;
    try { await api.delete(`/catalog/genres/${id}`); loadGenres(); } catch { /* */ }
  };

  const handleDeleteArtist = async (id: string) => {
    if (!window.confirm('Deactivate this artist?')) return;
    try { await api.delete(`/catalog/artists/${id}`); if (selectedGenre) loadArtists(selectedGenre); } catch { /* */ }
  };

  const handleDeleteAlbum = async (id: string) => {
    if (!window.confirm('Deactivate this album?')) return;
    try { await api.delete(`/catalog/albums/${id}`); if (selectedArtist) loadAlbums(selectedArtist); } catch { /* */ }
  };

  const handleDeleteSong = async (id: string) => {
    try { await api.delete(`/songs/${id}`); if (view === 'flat') fetchSongs({ search }); else if (selectedAlbum) loadAlbumSongs(selectedAlbum); } catch { /* */ }
  };

  const isAnyLoading = loading || flatLoading;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-jb-text-primary">Music Catalog</h2>
        <div className="flex gap-2 flex-wrap">
          <Link to="/admin/songs/bulk-upload">
            <Button variant="primary" size="sm">
              {'\uD83C\uDFB5'} Bulk Upload MP3s
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => { setFormError(''); setShowUpload(true); }}>
            {'\uD83D\uDCE4'} Upload MP3
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowBatchImport(true)}>Batch Import</Button>
          {view === 'flat' ? (
            <Button variant="primary" size="sm" onClick={() => setShowAddSong(true)}>Add Song</Button>
          ) : view === 'genres' ? (
            <Button variant="primary" size="sm" onClick={() => { setFormError(''); setShowAddGenre(true); }}>Add Genre</Button>
          ) : view === 'artists' ? (
            <Button variant="primary" size="sm" onClick={() => { setFormError(''); setShowAddArtist(true); }}>Add Artist</Button>
          ) : view === 'albums' ? (
            <Button variant="primary" size="sm" onClick={() => { setFormError(''); setShowAddAlbum(true); }}>Add Album</Button>
          ) : null}
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={goToGenres}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view !== 'flat' ? 'bg-jb-accent-green/20 text-jb-accent-green border border-jb-accent-green/30' : 'bg-jb-bg-secondary/50 text-jb-text-secondary hover:text-jb-text-primary'}`}
        >
          Hierarchy
        </button>
        <button
          onClick={goToFlat}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'flat' ? 'bg-jb-accent-green/20 text-jb-accent-green border border-jb-accent-green/30' : 'bg-jb-bg-secondary/50 text-jb-text-secondary hover:text-jb-text-primary'}`}
        >
          All Songs
        </button>
      </div>

      {/* Breadcrumb */}
      {view !== 'flat' && (
        <div className="flex items-center gap-1 text-sm mb-4 flex-wrap">
          <button onClick={goToGenres} className={`hover:text-jb-accent-green transition-colors ${view === 'genres' ? 'text-jb-accent-green font-medium' : 'text-jb-text-secondary'}`}>
            Genres
          </button>
          {selectedGenre && (
            <>
              <span className="text-jb-text-secondary/50 mx-1">/</span>
              <button onClick={goToArtists} className={`hover:text-jb-accent-green transition-colors ${view === 'artists' ? 'text-jb-accent-green font-medium' : 'text-jb-text-secondary'}`}>
                {selectedGenre.name}
              </button>
            </>
          )}
          {selectedArtist && (
            <>
              <span className="text-jb-text-secondary/50 mx-1">/</span>
              <button onClick={goToAlbums} className={`hover:text-jb-accent-green transition-colors ${view === 'albums' ? 'text-jb-accent-green font-medium' : 'text-jb-text-secondary'}`}>
                {selectedArtist.name}
              </button>
            </>
          )}
          {selectedAlbum && (
            <>
              <span className="text-jb-text-secondary/50 mx-1">/</span>
              <span className="text-jb-accent-green font-medium">{selectedAlbum.name}</span>
            </>
          )}
        </div>
      )}

      {/* Flat song search */}
      {view === 'flat' && (
        <div className="mb-4">
          <SearchBar value={search} onSearch={handleSearch} placeholder="Search songs..." />
        </div>
      )}

      {/* Loading */}
      {isAnyLoading ? (
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="80px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* ========== GENRES VIEW ========== */}
          {view === 'genres' && (
            genres.length === 0 ? (
              <p className="text-jb-text-secondary text-center py-20">No genres yet. Add one to get started.</p>
            ) : (
              <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
                {genres.map(g => (
                  <Card key={g.id} className="p-4 cursor-pointer hover:border-jb-accent-purple/30 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0" onClick={() => loadArtists(g)}>
                        <p className="text-jb-text-primary font-medium text-lg">{g.name}</p>
                        <p className="text-jb-text-secondary text-xs">{g._count?.artists ?? 0} artists</p>
                      </div>
                      <button
                        onClick={() => handleDeleteGenre(g.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-jb-text-secondary hover:text-red-400"
                        title="Deactivate"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {/* ========== ARTISTS VIEW ========== */}
          {view === 'artists' && (
            artists.length === 0 ? (
              <p className="text-jb-text-secondary text-center py-20">No artists in this genre yet.</p>
            ) : (
              <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
                {artists.map(a => (
                  <Card key={a.id} className="p-4 cursor-pointer hover:border-jb-accent-purple/30 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0" onClick={() => loadAlbums(a)}>
                        <p className="text-jb-text-primary font-medium">{a.name}</p>
                        <p className="text-jb-text-secondary text-xs">{a._count?.albums ?? 0} albums</p>
                      </div>
                      <button
                        onClick={() => handleDeleteArtist(a.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-jb-text-secondary hover:text-red-400"
                        title="Deactivate"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {/* ========== ALBUMS VIEW ========== */}
          {view === 'albums' && (
            albums.length === 0 ? (
              <p className="text-jb-text-secondary text-center py-20">No albums for this artist yet.</p>
            ) : (
              <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
                {albums.map(a => (
                  <Card key={a.id} className="p-4 cursor-pointer hover:border-jb-accent-purple/30 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0" onClick={() => loadAlbumSongs(a)}>
                        <p className="text-jb-text-primary font-medium">{a.name}</p>
                        <p className="text-jb-text-secondary text-xs">
                          {a.year && <span>{a.year} · </span>}
                          {a._count?.songs ?? 0} songs
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteAlbum(a.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-jb-text-secondary hover:text-red-400"
                        title="Deactivate"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {/* ========== SONGS VIEW (album songs) ========== */}
          {view === 'songs' && (
            catalogSongs.length === 0 ? (
              <p className="text-jb-text-secondary text-center py-20">No songs in this album yet.</p>
            ) : (
              <div className="space-y-2">
                {catalogSongs.map((song, i) => (
                  <Card key={song.id} className="p-3 group">
                    <div className="flex items-center gap-3">
                      <span className="text-jb-text-secondary text-sm w-6 text-center">{song.trackNumber || i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-jb-text-primary text-sm font-medium truncate">{song.title}</p>
                        <p className="text-jb-text-secondary text-xs truncate">{song.artist} · {formatDuration(song.duration)}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteSong(song.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-jb-text-secondary hover:text-red-400"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {/* ========== FLAT VIEW (all songs) ========== */}
          {view === 'flat' && (
            songs.length === 0 ? (
              <p className="text-jb-text-secondary text-center py-20">No songs found</p>
            ) : (
              <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
                {songs.map(song => (
                  <div key={song.id} className="relative group">
                    <SongCard title={song.title} artist={song.artist} duration={formatDuration(song.duration)} />
                    <button
                      onClick={() => handleDeleteSong(song.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-jb-highlight-pink/20 rounded-full p-1.5 hover:bg-jb-highlight-pink/40"
                    >
                      <svg className="w-4 h-4 text-jb-highlight-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* ========== ADD GENRE MODAL ========== */}
      <Modal isOpen={showAddGenre} onClose={() => setShowAddGenre(false)} title="Add Genre">
        <div className="space-y-4">
          <Input label="Genre Name" value={genreForm.name} onChange={e => setGenreForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Sort Order" type="number" value={String(genreForm.sortOrder)} onChange={e => setGenreForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <Button variant="primary" fullWidth loading={saving} onClick={handleAddGenre}>Create Genre</Button>
        </div>
      </Modal>

      {/* ========== ADD ARTIST MODAL ========== */}
      <Modal isOpen={showAddArtist} onClose={() => setShowAddArtist(false)} title={`Add Artist to ${selectedGenre?.name || ''}`}>
        <div className="space-y-4">
          <Input label="Artist Name" value={artistForm.name} onChange={e => setArtistForm(p => ({ ...p, name: e.target.value }))} />
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <Button variant="primary" fullWidth loading={saving} onClick={handleAddArtist}>Create Artist</Button>
        </div>
      </Modal>

      {/* ========== ADD ALBUM MODAL ========== */}
      <Modal isOpen={showAddAlbum} onClose={() => setShowAddAlbum(false)} title={`Add Album to ${selectedArtist?.name || ''}`}>
        <div className="space-y-4">
          <Input label="Album Name" value={albumForm.name} onChange={e => setAlbumForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Year" type="number" value={String(albumForm.year)} onChange={e => setAlbumForm(p => ({ ...p, year: parseInt(e.target.value) || 2024 }))} />
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <Button variant="primary" fullWidth loading={saving} onClick={handleAddAlbum}>Create Album</Button>
        </div>
      </Modal>

      {/* ========== ADD SONG MODAL ========== */}
      <Modal isOpen={showAddSong} onClose={() => setShowAddSong(false)} title="Add Song">
        <div className="space-y-4">
          <Input label="Title" value={songForm.title} onChange={e => setSongForm(p => ({ ...p, title: e.target.value }))} />
          <Input label="Artist" value={songForm.artist} onChange={e => setSongForm(p => ({ ...p, artist: e.target.value }))} />
          <Input label="Album" value={songForm.album} onChange={e => setSongForm(p => ({ ...p, album: e.target.value }))} />
          <Input label="Genre" value={songForm.genre} onChange={e => setSongForm(p => ({ ...p, genre: e.target.value }))} />
          <Input label="Duration (seconds)" type="number" value={String(songForm.duration)} onChange={e => setSongForm(p => ({ ...p, duration: parseInt(e.target.value) || 0 }))} />
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <Button variant="primary" fullWidth loading={saving} onClick={handleAddSong}>Add Song</Button>
        </div>
      </Modal>

      {/* ========== BATCH IMPORT MODAL ========== */}
      <Modal isOpen={showBatchImport} onClose={() => setShowBatchImport(false)} title="Batch Import">
        <div className="space-y-4">
          <p className="text-jb-text-secondary text-xs">
            Import multiple songs at once. Enter genre, artist, album, and paste one song title per line.
            The system will auto-create the genre/artist/album hierarchy.
          </p>
          <Input label="Genre" value={batchForm.genre} onChange={e => setBatchForm(p => ({ ...p, genre: e.target.value }))} placeholder="e.g. Sertanejo" />
          <Input label="Artist" value={batchForm.artist} onChange={e => setBatchForm(p => ({ ...p, artist: e.target.value }))} placeholder="e.g. Gusttavo Lima" />
          <Input label="Album" value={batchForm.album} onChange={e => setBatchForm(p => ({ ...p, album: e.target.value }))} placeholder="e.g. Buteco do Gusttavo" />
          <div>
            <label className="block text-jb-text-secondary text-sm mb-1">Songs (one title per line)</label>
            <textarea
              value={batchForm.songs}
              onChange={e => setBatchForm(p => ({ ...p, songs: e.target.value }))}
              rows={8}
              className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg px-3 py-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green resize-y"
              placeholder={"Balada\nGatinha Assanhada\nFui Fiel\nHomem de Família"}
            />
          </div>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <Button variant="primary" fullWidth loading={saving} onClick={handleBatchImport}>
            Import {batchForm.songs.split('\n').filter(l => l.trim()).length} Songs
          </Button>
        </div>
      </Modal>

      {/* ========== UPLOAD MP3 MODAL ========== */}
      <Modal
        isOpen={showUpload}
        onClose={() => {
          if (uploading) return;
          setShowUpload(false);
          setUploadFile(null);
          setFormError('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        title="Upload MP3"
      >
        <div className="space-y-4">
          <p className="text-jb-text-secondary text-sm">
            Upload an MP3 file to add a new song to the catalog. The file will be stored on the server.
          </p>

          {/* File picker */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,.mp3"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            {!uploadFile ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-white/20 rounded-xl hover:border-jb-accent-green/50 hover:bg-white/5 transition-all"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">{'\uD83C\uDFB5'}</div>
                  <p className="text-jb-text-primary text-sm font-medium">Click to select MP3 file</p>
                  <p className="text-jb-text-secondary text-xs mt-1">Max 50MB</p>
                </div>
              </button>
            ) : (
              <div className="bg-jb-bg-secondary/50 rounded-xl p-3 border border-jb-accent-green/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-jb-accent-green/20 flex items-center justify-center">
                    <span>{'\uD83C\uDFB5'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-jb-text-primary text-sm font-medium truncate">{uploadFile.name}</p>
                    <p className="text-jb-text-secondary text-xs">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  {!uploading && (
                    <button
                      onClick={() => {
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-jb-text-secondary hover:text-jb-highlight-pink p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metadata form */}
          <Input
            label="Title *"
            value={uploadForm.title}
            onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
            disabled={uploading}
          />
          <Input
            label="Artist *"
            value={uploadForm.artist}
            onChange={e => setUploadForm(p => ({ ...p, artist: e.target.value }))}
            disabled={uploading}
          />
          <Input
            label="Album"
            value={uploadForm.album}
            onChange={e => setUploadForm(p => ({ ...p, album: e.target.value }))}
            disabled={uploading}
          />
          <Input
            label="Genre"
            value={uploadForm.genre}
            onChange={e => setUploadForm(p => ({ ...p, genre: e.target.value }))}
            disabled={uploading}
          />

          {/* Progress bar */}
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-jb-text-secondary mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-jb-accent-green h-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {formError && <p className="text-red-400 text-sm">{formError}</p>}

          <Button
            variant="primary"
            fullWidth
            loading={uploading}
            disabled={!uploadFile || uploading}
            onClick={handleUploadSong}
          >
            {uploading ? 'Uploading...' : 'Upload Song'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
