import React, { useEffect, useState } from 'react';
import { Button, Card, Input } from '@jukebox/ui';
import { api } from '../lib/api';

interface EventConfig {
  skipQueue: { enabled: boolean; price: number };
  silence: { enabled: boolean; options: { duration: number; price: number }[]; immediateMultiplier?: number };
  textMessage: { enabled: boolean; price: number; maxLength: number; displayDuration: number };
  voiceMessage: { enabled: boolean; options: { duration: number; price: number }[]; requiresApproval: boolean };
  photo: { enabled: boolean; price: number; requiresApproval: boolean; displayDuration: number; displayMode?: 'corner' | 'fullscreen' };
  reaction: { enabled: boolean; price: number; types: string[] };
  birthday: { enabled: boolean; price: number; displayDuration?: number; displayMode?: 'corner' | 'fullscreen' };
}

interface EventConfigEditorProps {
  /** If venueId provided, edits venue config. Otherwise, edits global config. */
  venueId?: string;
}

export const EventConfigEditor: React.FC<EventConfigEditorProps> = ({ venueId }) => {
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const endpoint = venueId
    ? `/events/config/venue/${venueId}`
    : `/events/config/global`;

  useEffect(() => {
    setLoading(true);
    api.get(endpoint)
      .then(({ data }) => setConfig(data.data.events))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load config'))
      .finally(() => setLoading(false));
  }, [endpoint]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.put(endpoint, { events: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-jb-text-secondary text-sm">Loading...</div>;
  if (!config) return <div className="text-jb-highlight-pink text-sm">{error || 'Failed to load config'}</div>;

  return (
    <div className="space-y-4">
      <p className="text-jb-text-secondary text-sm">
        {venueId
          ? 'These settings override the global defaults for this venue only.'
          : 'These are the default settings for all venues. Each venue can override these.'}
      </p>

      {/* Skip Queue */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-jb-text-primary font-bold">Skip Queue (Fura-Fila)</h4>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.skipQueue.enabled}
              onChange={(e) => setConfig({ ...config, skipQueue: { ...config.skipQueue, enabled: e.target.checked } })}
            />
            Enabled
          </label>
        </div>
        <Input
          label="Price (R$)"
          type="number"
          step="0.01"
          value={String(config.skipQueue.price)}
          onChange={(e) => setConfig({ ...config, skipQueue: { ...config.skipQueue, price: parseFloat(e.target.value) || 0 } })}
        />
      </Card>

      {/* Silence */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-jb-text-primary font-bold">Silence</h4>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.silence.enabled}
              onChange={(e) => setConfig({ ...config, silence: { ...config.silence, enabled: e.target.checked } })}
            />
            Enabled
          </label>
        </div>
        <p className="text-jb-text-secondary text-xs mb-2">Base prices (when silence happens AFTER current song):</p>
        <div className="space-y-2">
          {config.silence.options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Input
                label={`Duration ${i + 1} (seconds)`}
                type="number"
                value={String(opt.duration)}
                onChange={(e) => {
                  const newOpts = [...config.silence.options];
                  newOpts[i] = { ...newOpts[i], duration: parseInt(e.target.value) || 0 };
                  setConfig({ ...config, silence: { ...config.silence, options: newOpts } });
                }}
              />
              <Input
                label="Price (R$)"
                type="number"
                step="0.01"
                value={String(opt.price)}
                onChange={(e) => {
                  const newOpts = [...config.silence.options];
                  newOpts[i] = { ...newOpts[i], price: parseFloat(e.target.value) || 0 };
                  setConfig({ ...config, silence: { ...config.silence, options: newOpts } });
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Input
            label="Immediate Silence Price Multiplier"
            type="number"
            step="0.1"
            value={String(config.silence.immediateMultiplier ?? 2.5)}
            onChange={(e) => setConfig({ ...config, silence: { ...config.silence, immediateMultiplier: parseFloat(e.target.value) || 1 } })}
          />
          <p className="text-jb-text-secondary text-xs mt-1">
            When customer chooses "Right now" (interrupt current song), price is multiplied by this. Default: 2.5x
          </p>
        </div>
      </Card>

      {/* Text Message */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-jb-text-primary font-bold">Text Message</h4>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.textMessage.enabled}
              onChange={(e) => setConfig({ ...config, textMessage: { ...config.textMessage, enabled: e.target.checked } })}
            />
            Enabled
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Price (R$)"
            type="number"
            step="0.01"
            value={String(config.textMessage.price)}
            onChange={(e) => setConfig({ ...config, textMessage: { ...config.textMessage, price: parseFloat(e.target.value) || 0 } })}
          />
          <Input
            label="Display Duration (seconds)"
            type="number"
            value={String(config.textMessage.displayDuration)}
            onChange={(e) => setConfig({ ...config, textMessage: { ...config.textMessage, displayDuration: parseInt(e.target.value) || 0 } })}
          />
          <Input
            label="Max Length (chars)"
            type="number"
            value={String(config.textMessage.maxLength)}
            onChange={(e) => setConfig({ ...config, textMessage: { ...config.textMessage, maxLength: parseInt(e.target.value) || 0 } })}
          />
        </div>
      </Card>

      {/* Voice Message */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-jb-text-primary font-bold">Voice Message</h4>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.voiceMessage.enabled}
              onChange={(e) => setConfig({ ...config, voiceMessage: { ...config.voiceMessage, enabled: e.target.checked } })}
            />
            Enabled
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs mb-2">
          <input
            type="checkbox"
            checked={config.voiceMessage.requiresApproval}
            onChange={(e) => setConfig({ ...config, voiceMessage: { ...config.voiceMessage, requiresApproval: e.target.checked } })}
          />
          Requires bar owner approval
        </label>
        <div className="space-y-2">
          {config.voiceMessage.options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                label={`Duration ${i + 1} (seconds)`}
                type="number"
                value={String(opt.duration)}
                onChange={(e) => {
                  const newOpts = [...config.voiceMessage.options];
                  newOpts[i] = { ...newOpts[i], duration: parseInt(e.target.value) || 0 };
                  setConfig({ ...config, voiceMessage: { ...config.voiceMessage, options: newOpts } });
                }}
              />
              <Input
                label="Price (R$)"
                type="number"
                step="0.01"
                value={String(opt.price)}
                onChange={(e) => {
                  const newOpts = [...config.voiceMessage.options];
                  newOpts[i] = { ...newOpts[i], price: parseFloat(e.target.value) || 0 };
                  setConfig({ ...config, voiceMessage: { ...config.voiceMessage, options: newOpts } });
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Photo */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-jb-text-primary font-bold">Photo on TV</h4>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.photo.enabled}
              onChange={(e) => setConfig({ ...config, photo: { ...config.photo, enabled: e.target.checked } })}
            />
            Enabled
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs mb-2">
          <input
            type="checkbox"
            checked={config.photo.requiresApproval}
            onChange={(e) => setConfig({ ...config, photo: { ...config.photo, requiresApproval: e.target.checked } })}
          />
          Requires bar owner approval
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Price (R$)"
            type="number"
            step="0.01"
            value={String(config.photo.price)}
            onChange={(e) => setConfig({ ...config, photo: { ...config.photo, price: parseFloat(e.target.value) || 0 } })}
          />
          <Input
            label="Display Duration (seconds)"
            type="number"
            value={String(config.photo.displayDuration)}
            onChange={(e) => setConfig({ ...config, photo: { ...config.photo, displayDuration: parseInt(e.target.value) || 0 } })}
          />
        </div>
        <div className="mt-3">
          <label className="text-jb-text-secondary text-sm mb-1 block">Display Mode</label>
          <select
            value={config.photo.displayMode || 'corner'}
            onChange={(e) => setConfig({ ...config, photo: { ...config.photo, displayMode: e.target.value as 'corner' | 'fullscreen' } })}
            className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg p-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green"
          >
            <option value="corner">Corner (small, doesn't block music)</option>
            <option value="fullscreen">Fullscreen (large, blocks video)</option>
          </select>
        </div>
      </Card>

      {/* Reaction */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-jb-text-primary font-bold">Reactions</h4>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.reaction.enabled}
              onChange={(e) => setConfig({ ...config, reaction: { ...config.reaction, enabled: e.target.checked } })}
            />
            Enabled
          </label>
        </div>
        <Input
          label="Price per reaction (R$)"
          type="number"
          step="0.01"
          value={String(config.reaction.price)}
          onChange={(e) => setConfig({ ...config, reaction: { ...config.reaction, price: parseFloat(e.target.value) || 0 } })}
        />
      </Card>

      {/* Birthday */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-jb-text-primary font-bold">Birthday Pack</h4>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.birthday.enabled}
              onChange={(e) => setConfig({ ...config, birthday: { ...config.birthday, enabled: e.target.checked } })}
            />
            Enabled
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Price (R$)"
            type="number"
            step="0.01"
            value={String(config.birthday.price)}
            onChange={(e) => setConfig({ ...config, birthday: { ...config.birthday, price: parseFloat(e.target.value) || 0 } })}
          />
          <Input
            label="Display Duration (seconds)"
            type="number"
            value={String(config.birthday.displayDuration ?? 86400)}
            onChange={(e) => setConfig({ ...config, birthday: { ...config.birthday, displayDuration: parseInt(e.target.value) || 0 } })}
          />
        </div>
        <div className="mt-3">
          <label className="text-jb-text-secondary text-sm mb-1 block">Display Mode</label>
          <select
            value={config.birthday.displayMode || 'corner'}
            onChange={(e) => setConfig({ ...config, birthday: { ...config.birthday, displayMode: e.target.value as 'corner' | 'fullscreen' } })}
            className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg p-2.5 text-jb-text-primary text-sm focus:outline-none focus:border-jb-accent-green"
          >
            <option value="corner">Corner banner (persistent, music keeps playing)</option>
            <option value="fullscreen">Fullscreen celebration (with confetti, takes over screen)</option>
          </select>
          <p className="text-jb-text-secondary text-xs mt-1">
            Tip: Corner mode with 24h duration = 86400s, fullscreen mode = ~15s
          </p>
        </div>
      </Card>

      {error && <p className="text-jb-highlight-pink text-sm">{error}</p>}

      <Button variant="primary" fullWidth loading={saving} onClick={handleSave}>
        {saved ? 'Saved!' : 'Save Event Configuration'}
      </Button>
    </div>
  );
};
