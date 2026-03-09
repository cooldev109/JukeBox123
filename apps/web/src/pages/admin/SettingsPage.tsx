import React, { useEffect, useState } from 'react';
import { Card, Button, Input } from '@jukebox/ui';
import { useAdminStore } from '../../stores/adminStore';

export const SettingsPage: React.FC = () => {
  const { config, fetchConfig, updateConfig } = useAdminStore();
  const [localConfig, setLocalConfig] = useState({
    defaultSongPrice: 200,
    defaultPriorityPrice: 500,
    commissionRate: 30,
    maxQueueSize: 50,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (config) {
      setLocalConfig({
        defaultSongPrice: (config.defaultSongPrice as number) || 200,
        defaultPriorityPrice: (config.defaultPriorityPrice as number) || 500,
        commissionRate: (config.commissionRate as number) || 30,
        maxQueueSize: (config.maxQueueSize as number) || 50,
      });
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig(localConfig);
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
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">
        Global Settings
      </h2>

      <Card className="p-6 max-w-lg">
        <h3 className="text-lg font-bold text-jb-text-primary mb-4">Pricing</h3>
        <div className="space-y-4">
          <Input
            label="Default Song Price (centavos)"
            type="number"
            value={String(localConfig.defaultSongPrice)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLocalConfig({
                ...localConfig,
                defaultSongPrice: parseInt(e.target.value) || 0,
              })
            }
          />
          <Input
            label="Default Priority Price (centavos)"
            type="number"
            value={String(localConfig.defaultPriorityPrice)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLocalConfig({
                ...localConfig,
                defaultPriorityPrice: parseInt(e.target.value) || 0,
              })
            }
          />
          <Input
            label="Commission Rate (%)"
            type="number"
            value={String(localConfig.commissionRate)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLocalConfig({
                ...localConfig,
                commissionRate: parseInt(e.target.value) || 0,
              })
            }
          />
          <Input
            label="Max Queue Size"
            type="number"
            value={String(localConfig.maxQueueSize)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLocalConfig({
                ...localConfig,
                maxQueueSize: parseInt(e.target.value) || 0,
              })
            }
          />

          <Button
            variant="primary"
            fullWidth
            loading={saving}
            onClick={handleSave}
          >
            {saved ? 'Saved!' : 'Save Settings'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
