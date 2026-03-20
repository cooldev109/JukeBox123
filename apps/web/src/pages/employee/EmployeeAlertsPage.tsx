import React, { useEffect } from 'react';
import { Card, Skeleton } from '@jukebox/ui';
import { useEmployeeStore } from '../../stores/employeeStore';

export const EmployeeAlertsPage: React.FC = () => {
  const { alerts, isLoading, fetchAlerts } = useEmployeeStore();

  useEffect(() => {
    fetchAlerts();
  }, []);

  const severityBadge = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-jb-highlight-pink/20 text-jb-highlight-pink border border-jb-highlight-pink/30';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'LOW':
        return 'bg-jb-accent-green/20 text-jb-accent-green border border-jb-accent-green/30';
      default:
        return 'bg-white/10 text-jb-text-secondary border border-white/10';
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">Alerts</h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="80px" rounded="lg" className="w-full" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">{'\u2705'}</p>
          <p className="text-jb-text-secondary">No active alerts</p>
          <p className="text-jb-text-secondary/60 text-sm mt-1">
            All machines in your region are running normally
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className="p-4"
              glowColor={alert.severity === 'HIGH' ? 'pink' : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-jb-text-primary truncate">
                      {alert.machine?.name || 'Unknown Machine'}
                    </h4>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${severityBadge(alert.severity)}`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-jb-text-secondary text-sm">
                    {alert.machine?.venue?.name || 'Unknown Venue'}
                  </p>
                  <p className="text-jb-text-primary text-sm mt-2">
                    {alert.message}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-jb-text-secondary/60 text-xs">
                      Type: {alert.type}
                    </span>
                    <span className="text-jb-text-secondary/60 text-xs">
                      {new Date(alert.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
