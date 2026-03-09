export enum QueueItemStatus {
  PENDING = 'PENDING',
  PLAYING = 'PLAYING',
  PLAYED = 'PLAYED',
  SKIPPED = 'SKIPPED',
}

export interface QueueItem {
  id: string;
  machineId: string;
  songId: string;
  userId: string;
  position: number;
  status: QueueItemStatus;
  paidAmount: number;
  paymentMethod: string;
  isPriority: boolean;
  createdAt: string;
  playedAt: string | null;
  // Populated fields
  song?: Song;
  user?: { id: string; name: string };
}

// Avoid circular import — Song is defined in song.ts
import type { Song } from './song';

export interface QueueAddInput {
  machineId: string;
  songId: string;
  isPriority?: boolean;
}

export interface NowPlaying {
  queueItem: QueueItem | null;
  progress: number; // 0-100
  elapsedSeconds: number;
  totalSeconds: number;
}

// WebSocket events
export enum QueueEvent {
  UPDATED = 'queue:updated',
  SONG_ADDED = 'queue:song-added',
  SONG_REMOVED = 'queue:song-removed',
  NOW_PLAYING = 'queue:now-playing',
  PROGRESS = 'queue:progress',
}
