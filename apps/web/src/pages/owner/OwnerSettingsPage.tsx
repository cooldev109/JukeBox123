import React, { useEffect, useState } from 'react';
import { Card, Button, Input } from '@jukebox/ui';
import { useBarOwnerStore } from '../../stores/barOwnerStore';

export const OwnerSettingsPage: React.FC = () => {
  const { venue, playlists, fetchVenue, fetchPlaylists, updatePricing, updateSettings } = useBarOwnerStore();

  const [songPrice, setSongPrice] = useState(200);
  const [priorityPrice, setPriorityPrice] = useState(500);
  const [autoPlayPlaylistId, setAutoPlayPlaylistId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchVenue();
    fetchPlaylists();
  }, []);

  useEffect(() => {
    if (venue?.settings) {
      setSongPrice(venue.settings.songPrice || 200);
      setPriorityPrice(venue.settings.priorityPrice || 500);
      setAutoPlayPlaylistId(venue.settings.autoPlayPlaylistId || '');
    }
  }, [venue]);

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      await updatePricing(songPrice, priorityPrice);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateSettings({ autoPlayPlaylistId: autoPlayPlaylistId || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Settings</h2>

      <div className="space-y-6 max-w-lg">
        {/* Pricing */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-jb-text-primary mb-4">Song Pricing</h3>
          <div className="space-y-4">
            <Input
              label="Regular Song Price (centavos)"
              type="number"
              value={String(songPrice)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSongPrice(parseInt(e.target.value) || 0)}
            />
            <p className="text-jb-text-secondary text-xs">= R$ {(songPrice / 100).toFixed(2)} per song</p>
            <Input
              label="VIP / Priority Price (centavos)"
              type="number"
              value={String(priorityPrice)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPriorityPrice(parseInt(e.target.value) || 0)}
            />
            <p className="text-jb-text-secondary text-xs">= R$ {(priorityPrice / 100).toFixed(2)} per VIP song</p>
            <Button variant="primary" fullWidth loading={saving} onClick={handleSavePricing}>
              {saved ? 'Saved!' : 'Save Pricing'}
            </Button>
          </div>
        </Card>

        {/* Auto-Play Playlist */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-jb-text-primary mb-4">Auto-Play Playlist</h3>
          <p className="text-jb-text-secondary text-sm mb-4">
            Select a playlist to play when the queue is empty
          </p>
          <div className="space-y-3">
            <select
              value={autoPlayPlaylistId}
              onChange={(e) => setAutoPlayPlaylistId(e.target.value)}
              className="w-full bg-jb-bg-secondary border border-white/10 rounded-lg text-jb-text-primary px-4 py-3 focus:outline-none focus:border-jb-accent-purple"
            >
              <option value="">None (silence when queue is empty)</option>
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.name} ({pl.songCount} songs)</option>
              ))}
            </select>
            <Button variant="secondary" fullWidth loading={saving} onClick={handleSaveSettings}>
              Save Playlist Setting
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
