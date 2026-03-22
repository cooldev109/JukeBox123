import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { useEventsStore } from './eventsStore';
import { api } from '../lib/api';

const mockApi = api as any;

beforeEach(() => {
  vi.clearAllMocks();
  useEventsStore.setState({
    config: null,
    pendingEvents: [],
    isLoading: false,
    error: null,
  });
});

describe('Events Store', () => {
  describe('fetchConfig', () => {
    it('loads event config from API', async () => {
      const mockConfig = {
        skipQueue: { enabled: true, price: 5 },
        silence: { enabled: true, options: [{ duration: 60, price: 5 }] },
        textMessage: { enabled: true, price: 2, maxLength: 200 },
        voiceMessage: { enabled: true, options: [{ duration: 5, price: 8 }], requiresApproval: true },
        photo: { enabled: true, price: 5, requiresApproval: true },
        reaction: { enabled: true, price: 1, types: ['APPLAUSE', 'FIRE'] },
        birthday: { enabled: true, price: 25 },
      };

      mockApi.get.mockResolvedValue({ data: { data: { events: mockConfig } } });

      await useEventsStore.getState().fetchConfig('machine-1');

      expect(mockApi.get).toHaveBeenCalledWith('/events/config?machineId=machine-1');
      expect(useEventsStore.getState().config).toEqual(mockConfig);
      expect(useEventsStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      mockApi.get.mockRejectedValue({ response: { data: { error: 'Machine not found' } } });

      await useEventsStore.getState().fetchConfig('bad-id');

      expect(useEventsStore.getState().error).toBe('Machine not found');
    });
  });

  describe('purchaseSilence', () => {
    it('posts silence event and returns result', async () => {
      mockApi.post.mockResolvedValue({
        data: { data: { eventId: 'e1', transactionId: 't1' } },
      });

      const result = await useEventsStore.getState().purchaseSilence('m1', 60);

      expect(mockApi.post).toHaveBeenCalledWith('/events/silence', { machineId: 'm1', duration: 60 });
      expect(result.eventId).toBe('e1');
    });

    it('sets error on failure', async () => {
      mockApi.post.mockRejectedValue({ response: { data: { error: 'Insufficient balance' } } });

      await expect(useEventsStore.getState().purchaseSilence('m1', 60)).rejects.toThrow('Insufficient balance');
      expect(useEventsStore.getState().error).toBe('Insufficient balance');
    });
  });

  describe('purchaseTextMessage', () => {
    it('posts text message event', async () => {
      mockApi.post.mockResolvedValue({
        data: { data: { eventId: 'e1', transactionId: 't1' } },
      });

      const result = await useEventsStore.getState().purchaseTextMessage('m1', 'Hello!');

      expect(mockApi.post).toHaveBeenCalledWith('/events/text-message', { machineId: 'm1', message: 'Hello!' });
      expect(result.eventId).toBe('e1');
    });
  });

  describe('purchaseReaction', () => {
    it('posts reaction event', async () => {
      mockApi.post.mockResolvedValue({
        data: { data: { eventId: 'e1', transactionId: 't1' } },
      });

      const result = await useEventsStore.getState().purchaseReaction('m1', 'FIRE');

      expect(mockApi.post).toHaveBeenCalledWith('/events/reaction', { machineId: 'm1', reactionType: 'FIRE' });
      expect(result.eventId).toBe('e1');
    });
  });

  describe('purchaseBirthday', () => {
    it('posts birthday event with name and optional message', async () => {
      mockApi.post.mockResolvedValue({
        data: { data: { eventId: 'e1', transactionId: 't1' } },
      });

      const result = await useEventsStore.getState().purchaseBirthday('m1', 'Maria', 'Happy bday!');

      expect(mockApi.post).toHaveBeenCalledWith('/events/birthday', {
        machineId: 'm1',
        birthdayName: 'Maria',
        message: 'Happy bday!',
      });
      expect(result.eventId).toBe('e1');
    });
  });

  describe('purchaseSkipQueue', () => {
    it('posts skip-queue event', async () => {
      mockApi.post.mockResolvedValue({
        data: { data: { eventId: 'e1', transactionId: 't1', position: 2 } },
      });

      const result = await useEventsStore.getState().purchaseSkipQueue('m1', 'q1');

      expect(mockApi.post).toHaveBeenCalledWith('/events/skip-queue', { machineId: 'm1', queueItemId: 'q1' });
      expect(result.transactionId).toBe('t1');
    });
  });

  describe('fetchPending', () => {
    it('loads pending events', async () => {
      const events = [
        { id: 'e1', type: 'VOICE_MESSAGE', status: 'PENDING_APPROVAL', user: { name: 'Test' } },
      ];
      mockApi.get.mockResolvedValue({ data: { data: { events } } });

      await useEventsStore.getState().fetchPending();

      expect(useEventsStore.getState().pendingEvents).toEqual(events);
    });
  });

  describe('approveEvent', () => {
    it('approves event and removes from pending list', async () => {
      useEventsStore.setState({
        pendingEvents: [
          { id: 'e1', type: 'VOICE_MESSAGE', status: 'PENDING_APPROVAL' } as any,
          { id: 'e2', type: 'PHOTO', status: 'PENDING_APPROVAL' } as any,
        ],
      });
      mockApi.post.mockResolvedValue({ data: {} });

      await useEventsStore.getState().approveEvent('e1');

      expect(mockApi.post).toHaveBeenCalledWith('/events/e1/approve');
      expect(useEventsStore.getState().pendingEvents).toHaveLength(1);
      expect(useEventsStore.getState().pendingEvents[0].id).toBe('e2');
    });
  });

  describe('rejectEvent', () => {
    it('rejects event and removes from pending list', async () => {
      useEventsStore.setState({
        pendingEvents: [
          { id: 'e1', type: 'VOICE_MESSAGE', status: 'PENDING_APPROVAL' } as any,
        ],
      });
      mockApi.post.mockResolvedValue({ data: {} });

      await useEventsStore.getState().rejectEvent('e1');

      expect(mockApi.post).toHaveBeenCalledWith('/events/e1/reject');
      expect(useEventsStore.getState().pendingEvents).toHaveLength(0);
    });
  });

  describe('uploadMedia', () => {
    it('uploads file and returns URL', async () => {
      mockApi.post.mockResolvedValue({
        data: { data: { url: '/uploads/test.webm' } },
      });

      const url = await useEventsStore.getState().uploadMedia('base64data', 'audio');

      expect(mockApi.post).toHaveBeenCalledWith('/events/upload', { file: 'base64data', type: 'audio' });
      expect(url).toBe('/uploads/test.webm');
    });
  });
});
