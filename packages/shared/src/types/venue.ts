export enum VenueStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface VenueSettings {
  songPrice: number;
  prioritySongPrice: number;
  creditTopUpAmounts: number[];
  barOwnerCommissionPercent: number;
  featureToggles: Record<string, boolean>;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  ownerId: string;
  timezone: string;
  currency: string;
  settings: VenueSettings;
  status: VenueStatus;
  installDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VenueCreateInput {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  ownerId: string;
  timezone?: string;
  currency?: string;
}
