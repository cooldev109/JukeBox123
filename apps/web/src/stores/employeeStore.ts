import { create } from 'zustand';
import { api } from '../lib/api';

interface Machine {
  id: string;
  name: string;
  status: string;
  lastHeartbeat: string | null;
  venue: { id: string; name: string; city: string; state: string };
}

interface MachineAlert {
  id: string;
  machineId: string;
  type: string;
  message: string;
  severity: string;
  isResolved: boolean;
  resolvedAt: string | null;
  notifiedVia: string;
  createdAt: string;
  machine?: { id: string; name: string; venue?: { name: string } };
}

interface Venue {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  status: string;
  owner: { id: string; name: string; email: string | null };
  _count?: { machines: number };
}

interface EmployeeState {
  machines: Machine[];
  venues: Venue[];
  alerts: MachineAlert[];
  isLoading: boolean;
  fetchMachines: () => Promise<void>;
  fetchVenues: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  machines: [],
  venues: [],
  alerts: [],
  isLoading: false,

  fetchMachines: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/machines');
      set({ machines: data.data.machines || [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchVenues: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/venues');
      set({ venues: data.data.venues || [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAlerts: async () => {
    try {
      // Alerts are fetched from machines' data for now
      // In future, dedicated /alerts endpoint
      const { data } = await api.get('/machines');
      const machines = data.data.machines || [];
      const alertList: MachineAlert[] = [];
      for (const m of machines) {
        if (m.status === 'ERROR' || m.status === 'ALERT') {
          alertList.push({
            id: m.id,
            machineId: m.id,
            type: m.status === 'ERROR' ? 'AUDIO_FAIL' : 'OWNER_INACTIVE',
            message: m.status === 'ERROR' ? 'Machine reporting errors' : 'Machine inactive — owner alert',
            severity: m.status === 'ERROR' ? 'HIGH' : 'MEDIUM',
            isResolved: false,
            resolvedAt: null,
            notifiedVia: 'DASHBOARD',
            createdAt: m.lastHeartbeat || new Date().toISOString(),
            machine: { id: m.id, name: m.name, venue: m.venue },
          });
        }
      }
      set({ alerts: alertList });
    } catch {
      set({ alerts: [] });
    }
  },
}));
