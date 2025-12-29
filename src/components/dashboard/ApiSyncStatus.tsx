import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Clock, RefreshCw, Wifi, WifiOff, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface SyncStatus {
  status: 'online' | 'offline' | 'syncing' | 'error' | 'retrying';
  lastSynced: string | null;
  apiRecordCount: number | null;
  dbRecordCount: number | null;
  retryAttempt?: number;
  nextRetryIn?: number;
  lastError?: string;
}

interface ApiSyncStatusProps {
  syncStatus: SyncStatus;
}

export const ApiSyncStatus = ({ syncStatus }: ApiSyncStatusProps) => {
  const [displayRetryIn, setDisplayRetryIn] = useState<number | null>(null);

  useEffect(() => {
    if (syncStatus.nextRetryIn && syncStatus.nextRetryIn > 0) {
      setDisplayRetryIn(Math.ceil(syncStatus.nextRetryIn / 1000));
      const interval = setInterval(() => {
        setDisplayRetryIn(prev => {
          if (prev && prev > 1) return prev - 1;
          return null;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setDisplayRetryIn(null);
    }
  }, [syncStatus.nextRetryIn]);

  const getStatusConfig = () => {
    switch (syncStatus.status) {
      case 'online':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          label: 'Connected',
          variant: 'default' as const,
          className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20',
        };
      case 'syncing':
        return {
          icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          label: 'Syncing...',
          variant: 'default' as const,
          className: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20',
        };
      case 'retrying':
        return {
          icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          label: displayRetryIn ? `Retry in ${displayRetryIn}s` : `Retry #${syncStatus.retryAttempt}`,
          variant: 'default' as const,
          className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20',
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          label: 'Error',
          variant: 'destructive' as const,
          className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20',
        };
      case 'offline':
      default:
        return {
          icon: <WifiOff className="h-4 w-4" />,
          label: 'Offline',
          variant: 'secondary' as const,
          className: 'bg-muted text-muted-foreground border-muted hover:bg-muted/80',
        };
    }
  };

  const config = getStatusConfig();
  const hasDataMismatch = syncStatus.apiRecordCount && syncStatus.dbRecordCount && 
    syncStatus.apiRecordCount !== syncStatus.dbRecordCount;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 px-3 py-2 bg-card/50 border border-border/50 rounded-lg">
        {/* Status Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`gap-1.5 ${config.className}`}>
              {config.icon}
              <span className="text-xs font-medium">{config.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <p className="font-medium">API Status: {config.label}</p>
              {syncStatus.lastError && (
                <p className="text-destructive mt-1">{syncStatus.lastError}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Last Synced Time */}
        {syncStatus.lastSynced && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTime(syncStatus.lastSynced)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Last synced: {formatDate(syncStatus.lastSynced)} at {formatTime(syncStatus.lastSynced)}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Record Count */}
        {syncStatus.dbRecordCount !== null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-1.5 text-xs ${hasDataMismatch ? 'text-amber-600' : 'text-muted-foreground'}`}>
                <Database className="h-3.5 w-3.5" />
                <span>{syncStatus.dbRecordCount.toLocaleString()}</span>
                {hasDataMismatch && (
                  <span className="text-amber-600">
                    / {syncStatus.apiRecordCount?.toLocaleString()}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p>Database: {syncStatus.dbRecordCount?.toLocaleString()} records</p>
                {syncStatus.apiRecordCount && (
                  <p>API: {syncStatus.apiRecordCount.toLocaleString()} records</p>
                )}
                {hasDataMismatch && (
                  <p className="text-amber-600 mt-1">
                    {(syncStatus.apiRecordCount! - syncStatus.dbRecordCount!).toLocaleString()} records pending sync
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};
