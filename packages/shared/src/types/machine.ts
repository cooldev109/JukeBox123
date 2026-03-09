export enum MachineStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
  // Stage 2: ALERT = 'ALERT',
}

export interface MachineConfig {
  volume: number;
  screenSettings: Record<string, unknown>;
  autoPlay: boolean;
  defaultPlaylistId?: string;
  venueNameOverlay?: string;
  queueVisible: boolean;
}

export interface Machine {
  id: string;
  venueId: string;
  name: string;
  serialNumber: string;
  status: MachineStatus;
  lastHeartbeat: string | null;
  ipAddress: string | null;
  offlineSongCache: string[];
  config: MachineConfig;
  createdAt: string;
  updatedAt: string;
}

export interface MachineCreateInput {
  venueId: string;
  name: string;
  serialNumber: string;
  config?: Partial<MachineConfig>;
}

export interface HeartbeatPayload {
  machineId: string;
  currentSongId: string | null;
  queueLength: number;
  networkStatus: 'online' | 'offline';
  timestamp: string;
}
