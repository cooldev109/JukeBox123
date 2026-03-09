export interface Playlist {
  id: string;
  userId: string;
  name: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistCreateInput {
  name: string;
  songIds?: string[];
}
