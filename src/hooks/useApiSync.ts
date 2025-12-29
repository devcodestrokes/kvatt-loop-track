import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SyncStatus {
  status: 'online' | 'offline' | 'syncing' | 'error' | 'retrying';
  lastSynced: string | null;
  apiRecordCount: number | null;
  dbRecordCount: number | null;
  retryAttempt?: number;
  nextRetryIn?: number;
  lastError?: string;
}

interface UseApiSyncOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onNewOrdersDetected?: (newCount: number) => void;
  onSyncComplete?: (data: any) => void;
}

const STORAGE_KEY_LAST_SYNCED = 'kvatt_api_last_synced';
const STORAGE_KEY_API_COUNT = 'kvatt_api_record_count';

export const useApiSync = (options: UseApiSyncOptions = {}) => {
  const {
    maxRetries = 5,
    baseDelayMs = 2000,
    maxDelayMs = 60000,
    onNewOrdersDetected,
    onSyncComplete,
  } = options;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => ({
    status: 'offline',
    lastSynced: localStorage.getItem(STORAGE_KEY_LAST_SYNCED),
    apiRecordCount: parseInt(localStorage.getItem(STORAGE_KEY_API_COUNT) || '0') || null,
    dbRecordCount: null,
  }));

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate exponential backoff delay
  const getRetryDelay = (attempt: number): number => {
    const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  };

  // Get current DB record count
  const getDbRecordCount = async (): Promise<number> => {
    const { count, error } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error getting DB count:', error);
      return 0;
    }
    return count || 0;
  };

  // Main sync function with retry logic
  const syncOrders = useCallback(async (
    triggerRefresh = true,
    retryAttempt = 0
  ): Promise<boolean> => {
    // Cancel any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const isRetrying = retryAttempt > 0;

    setSyncStatus(prev => ({
      ...prev,
      status: isRetrying ? 'retrying' : 'syncing',
      retryAttempt: isRetrying ? retryAttempt : undefined,
      nextRetryIn: undefined,
      lastError: undefined,
    }));

    try {
      if (!isRetrying) {
        toast.loading('Syncing orders from API...', { id: 'api-sync' });
      }

      const { data, error } = await supabase.functions.invoke('fetch-orders-api', {
        body: { refresh: triggerRefresh }
      });

      if (error) {
        throw new Error(error.message || 'Failed to sync orders');
      }

      // Handle retryable errors (API temporarily unavailable)
      if (data?.retryable) {
        const errorMessage = data.error || 'API temporarily unavailable';
        
        if (retryAttempt < maxRetries) {
          const delay = getRetryDelay(retryAttempt);
          
          setSyncStatus(prev => ({
            ...prev,
            status: 'retrying',
            retryAttempt: retryAttempt + 1,
            nextRetryIn: delay,
            lastError: errorMessage,
          }));

          toast.loading(
            `API unavailable. Retry ${retryAttempt + 1}/${maxRetries} in ${Math.ceil(delay / 1000)}s...`,
            { id: 'api-sync' }
          );

          retryTimeoutRef.current = setTimeout(() => {
            syncOrders(triggerRefresh, retryAttempt + 1);
          }, delay);

          return false;
        } else {
          // Max retries exceeded
          throw new Error(`${errorMessage} (max retries exceeded)`);
        }
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unknown error during sync');
      }

      // Success! Update status
      const now = new Date().toISOString();
      const dbCount = await getDbRecordCount();
      const prevDbCount = syncStatus.dbRecordCount || 0;
      const newOrders = dbCount - prevDbCount;

      localStorage.setItem(STORAGE_KEY_LAST_SYNCED, now);
      if (data.apiRecordCount) {
        localStorage.setItem(STORAGE_KEY_API_COUNT, data.apiRecordCount.toString());
      }

      setSyncStatus({
        status: 'online',
        lastSynced: now,
        apiRecordCount: data.apiRecordCount || null,
        dbRecordCount: dbCount,
        retryAttempt: undefined,
        nextRetryIn: undefined,
        lastError: undefined,
      });

      // Notify about new orders
      if (newOrders > 0 && onNewOrdersDetected) {
        onNewOrdersDetected(newOrders);
      }

      toast.success(
        `Synced ${data.inserted?.toLocaleString() || 0} orders. Total: ${dbCount.toLocaleString()}`,
        { id: 'api-sync' }
      );

      if (onSyncComplete) {
        onSyncComplete(data);
      }

      return true;

    } catch (error: any) {
      console.error('Sync error:', error);

      setSyncStatus(prev => ({
        ...prev,
        status: 'error',
        lastError: error.message,
        retryAttempt: undefined,
        nextRetryIn: undefined,
      }));

      toast.error(error.message || 'Failed to sync orders', { id: 'api-sync' });
      return false;
    }
  }, [maxRetries, baseDelayMs, maxDelayMs, onNewOrdersDetected, onSyncComplete, syncStatus.dbRecordCount]);

  // Cancel pending operations on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Update DB count periodically
  const refreshDbCount = useCallback(async () => {
    const count = await getDbRecordCount();
    setSyncStatus(prev => ({ ...prev, dbRecordCount: count }));
    return count;
  }, []);

  // Check for new orders (compares current DB count with stored count)
  const checkForNewOrders = useCallback(async (): Promise<number> => {
    const currentCount = await getDbRecordCount();
    const prevCount = syncStatus.dbRecordCount || 0;
    
    if (currentCount > prevCount) {
      const newOrders = currentCount - prevCount;
      setSyncStatus(prev => ({ ...prev, dbRecordCount: currentCount }));
      return newOrders;
    }
    
    return 0;
  }, [syncStatus.dbRecordCount]);

  return {
    syncStatus,
    syncOrders,
    refreshDbCount,
    checkForNewOrders,
    isLoading: syncStatus.status === 'syncing' || syncStatus.status === 'retrying',
  };
};
