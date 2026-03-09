export enum SongFormat {
  MP3 = 'MP3',
  MP4 = 'MP4',
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string;
  duration: number; // seconds
  fileUrl: string;
  videoUrl: string | null;
  coverArtUrl: string | null;
  metadata: Record<string, unknown>;
  fileSize: number; // bytes
  format: SongFormat;
  isActive: boolean;
  addedAt: string;
}

export interface SongCreateInput {
  title: string;
  artist: string;
  album?: string;
  genre: string;
  duration: number;
  fileUrl: string;
  videoUrl?: string;
  coverArtUrl?: string;
  fileSize: number;
  format: SongFormat;
}

export interface SongSearchParams {
  query?: string;
  genre?: string;
  artist?: string;
  album?: string;
  sortBy?: 'popularity' | 'recent' | 'title' | 'artist';
  page?: number;
  limit?: number;
}

export interface SongRequestInput {
  title: string;
  artist: string;
  userId: string;
  notes?: string;
}
