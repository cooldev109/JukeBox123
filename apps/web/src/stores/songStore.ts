import { create } from 'zustand';
import { api } from '../lib/api';

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string;
  duration: number;
  coverArtUrl: string | null;
  fileUrl: string;
  format: string;
}

interface SongState {
  songs: Song[];
  genres: string[];
  totalCount: number;
  isLoading: boolean;
  searchQuery: string;
  selectedGenre: string | null;
  currentPage: number;
  fetchSongs: (params?: { search?: string; genre?: string; page?: number }) => Promise<void>;
  fetchGenres: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setSelectedGenre: (genre: string | null) => void;
  setCurrentPage: (page: number) => void;
}

export const useSongStore = create<SongState>((set, get) => ({
  songs: [],
  genres: [],
  totalCount: 0,
  isLoading: false,
  searchQuery: '',
  selectedGenre: null,
  currentPage: 1,

  fetchSongs: async (params) => {
    set({ isLoading: true });
    try {
      const query = new URLSearchParams();
      const search = params?.search ?? get().searchQuery;
      const genre = params?.genre ?? get().selectedGenre;
      const page = params?.page ?? get().currentPage;

      if (search) query.set('query', search);
      if (genre) query.set('genre', genre);
      query.set('page', String(page));
      query.set('limit', '20');

      const { data } = await api.get(`/songs?${query.toString()}`);
      const songs = data.data?.songs || [];
      set({ songs, totalCount: data.data?.pagination?.total ?? songs.length });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchGenres: async () => {
    try {
      const { data } = await api.get('/songs/genres');
      set({ genres: data.data?.genres || [] });
    } catch {
      // Ignore
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q, currentPage: 1 }),
  setSelectedGenre: (genre) => set({ selectedGenre: genre, currentPage: 1 }),
  setCurrentPage: (page) => set({ currentPage: page }),
}));
