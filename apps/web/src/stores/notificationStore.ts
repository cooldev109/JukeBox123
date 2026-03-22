import { create } from 'zustand';
import { api } from '../lib/api';

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  machine: {
    id: string;
    name: string;
    venue: { id: string; name: string };
  };
}

interface NotificationState {
  alerts: Alert[];
  unreadCount: number;
  isLoading: boolean;
  vapidKey: string | null;
  isSubscribed: boolean;

  fetchAlerts: () => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  markAllRead: () => void;
  fetchVapidKey: () => Promise<void>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,
  vapidKey: null,
  isSubscribed: false,

  fetchAlerts: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/notifications/history');
      const alerts = data.data.alerts || [];
      const unresolved = alerts.filter((a: Alert) => !a.isResolved).length;
      set({ alerts, unreadCount: unresolved });
    } catch {
      // Silently fail
    } finally {
      set({ isLoading: false });
    }
  },

  resolveAlert: async (alertId) => {
    try {
      await api.post(`/notifications/alerts/${alertId}/resolve`);
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === alertId ? { ...a, isResolved: true, resolvedAt: new Date().toISOString() } : a,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Error
    }
  },

  markAllRead: () => {
    set({ unreadCount: 0 });
  },

  fetchVapidKey: async () => {
    try {
      const { data } = await api.get('/notifications/vapid-key');
      set({ vapidKey: data.data.publicKey });
    } catch {
      // VAPID key not configured
    }
  },

  subscribe: async () => {
    const { vapidKey } = get();
    if (!vapidKey) return;

    try {
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker?.ready;
      if (!registration) return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      await api.post('/notifications/subscribe', {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        },
      });

      set({ isSubscribed: true });
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  },

  unsubscribe: async () => {
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (!registration) return;

      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete('/notifications/subscribe', {
          data: { endpoint: subscription.endpoint },
        });
        await subscription.unsubscribe();
      }
      set({ isSubscribed: false });
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
    }
  },
}));

// Helper: convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
