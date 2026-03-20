import React, { useEffect, useState } from 'react';
import { Card, Skeleton } from '@jukebox/ui';
import { api } from '../../lib/api';

interface MachineAlert {
  id: string;
  type: string;
  message: string;
  severity: string;
  machineName: string;
  createdAt: string;
}

export const OwnerAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<MachineAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/machines');
      const machines = data.data.machines || [];
      const alertList: MachineAlert[] = [];
      for (const m of machines) {
        if (m.status === 'ERROR' || m.status === 'ALERT') {
          alertList.push({
            id: m.id,
            type: m.status === 'ERROR' ? 'AUDIO_FAIL' : 'OWNER_INACTIVE',
            message: m.status === 'ERROR' ? 'Machine reporting errors' : 'Machine needs attention',
            severity: m.status === 'ERROR' ? 'HIGH' : 'MEDIUM',
            machineName: m.name,
            createdAt: m.lastHeartbeat || new Date().toISOString(),
          });
        }
      }
      setAlerts(alertList);
    } finally {
      setIsLoading(false);
    }
  };

  const severityColor = (severity: string) => {
    if (severity === 'HIGH') return 'text-jb-highlight-pink bg-jb-highlight-pink/20';
    if (severity === 'MEDIUM') return 'text-amber-400 bg-amber-400/20';
    return 'text-jb-accent-green bg-jb-accent-green/20';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Machine Alerts</h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height="72px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-jb-text-secondary">All your machines are operating normally</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id} className="p-4" glowColor={alert.severity === 'HIGH' ? 'pink' : undefined}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${severityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="text-jb-text-secondary text-xs">{alert.type}</span>
                  </div>
                  <p className="text-jb-text-primary font-medium">{alert.message}</p>
                  <p className="text-jb-text-secondary text-xs mt-1">{alert.machineName}</p>
                </div>
                <p className="text-jb-text-secondary text-xs whitespace-nowrap">
                  {new Date(alert.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
