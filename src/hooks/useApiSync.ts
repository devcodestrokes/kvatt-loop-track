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
  autoRefreshInterval?: number; // ms, 0 to disable
  onNewOrdersDetected?: (newCount: number) => void;
  onSyncComplete?: (data: any) => void;
}

const STORAGE_KEY_LAST_SYNCED = 'kvatt_api_last_synced';
const STORAGE_KEY_API_COUNT = 'kvatt_api_record_count';
const STORAGE_KEY_SYNC_LOCK = 'kvatt_sync_lock';
const LOCK_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes lock

export const useApiSync = (options: UseApiSyncOptions = {}) => {
  const {
    maxRetries = 5,
    baseDelayMs = 2000,
    maxDelayMs = 60000,
    autoRefreshInterval = 60000, // 1 minute default
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
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Calculate exponential backoff delay
  const getRetryDelay = (attempt: number): number => {
    const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  };

  // Check if another tab/user is syncing (via localStorage)
  const acquireLock = (): boolean => {
    const lockData = localStorage.getItem(STORAGE_KEY_SYNC_LOCK);
    if (lockData) {
      const { timestamp } = JSON.parse(lockData);
      // Check if lock is still valid
      if (Date.now() - timestamp < LOCK_TIMEOUT_MS) {
        console.log('Sync already in progress by another session');
        return false;
      }
    }
    // Acquire lock
    localStorage.setItem(STORAGE_KEY_SYNC_LOCK, JSON.stringify({ timestamp: Date.now() }));
    return true;
  };

  const releaseLock = () => {
    localStorage.removeItem(STORAGE_KEY_SYNC_LOCK);
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

  // Main sync function with retry logic and lock
  const syncOrders = useCallback(async (
    triggerRefresh = true,
    retryAttempt = 0,
    forceFull = false
  ): Promise<boolean> => {
    // Check for existing lock (prevent multiple concurrent syncs)
    if (retryAttempt === 0 && !acquireLock()) {
      toast.info('Sync already in progress. Please wait...', { id: 'api-sync' });
      
      // Just refresh the DB count instead
      const dbCount = await getDbRecordCount();
      setSyncStatus(prev => ({ ...prev, dbRecordCount: dbCount }));
      return false;
    }

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
        body: { 
          refresh: triggerRefresh,
          incremental: !forceFull, // Use incremental sync by default
          forceFull: forceFull
        }
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
            dbRecordCount: data.dbCount || prev.dbRecordCount,
          }));

          toast.loading(
            `API busy. Retry ${retryAttempt + 1}/${maxRetries} in ${Math.ceil(delay / 1000)}s...`,
            { id: 'api-sync' }
          );

          retryTimeoutRef.current = setTimeout(() => {
            syncOrders(triggerRefresh, retryAttempt + 1, forceFull);
          }, delay);

          return false;
        } else {
          releaseLock();
          throw new Error(`${errorMessage} (max retries exceeded)`);
        }
      }

      if (!data?.success) {
        releaseLock();
        throw new Error(data?.error || 'Unknown error during sync');
      }

      // Success! Update status
      const now = new Date().toISOString();
      const dbCount = data.total || await getDbRecordCount();
      const prevDbCount = syncStatus.dbRecordCount || 0;
      const newOrders = data.inserted || 0;

      localStorage.setItem(STORAGE_KEY_LAST_SYNCED, now);
      if (data.apiRecordCount) {
        localStorage.setItem(STORAGE_KEY_API_COUNT, data.apiRecordCount.toString());
      }

      if (isMountedRef.current) {
        setSyncStatus({
          status: 'online',
          lastSynced: now,
          apiRecordCount: data.apiRecordCount || null,
          dbRecordCount: dbCount,
          retryAttempt: undefined,
          nextRetryIn: undefined,
          lastError: undefined,
        });
      }

      // Notify about new orders
      if (newOrders > 0 && onNewOrdersDetected) {
        onNewOrdersDetected(newOrders);
      }

      const message = data.wasIncremental 
        ? `Synced ${newOrders.toLocaleString()} new orders. Total: ${dbCount.toLocaleString()}`
        : `Synced ${data.inserted?.toLocaleString() || 0} orders. Total: ${dbCount.toLocaleString()}`;

      toast.success(message, { id: 'api-sync' });

      if (onSyncComplete) {
        onSyncComplete(data);
      }

      releaseLock();
      return true;

    } catch (error: any) {
      console.error('Sync error:', error);
      releaseLock();

      if (isMountedRef.current) {
        setSyncStatus(prev => ({
          ...prev,
          status: 'error',
          lastError: error.message,
          retryAttempt: undefined,
          nextRetryIn: undefined,
        }));
      }

      toast.error(error.message || 'Failed to sync orders', { id: 'api-sync' });
      return false;
    }
  }, [maxRetries, baseDelayMs, maxDelayMs, onNewOrdersDetected, onSyncComplete, syncStatus.dbRecordCount]);

  // Force full sync (bypasses incremental)
  const syncOrdersFull = useCallback(async (triggerRefresh = true): Promise<boolean> => {
    return syncOrders(triggerRefresh, 0, true);
  }, [syncOrders]);

  // Cancel pending operations and clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (autoRefreshRef.current) {
        clearTimeout(autoRefreshRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-refresh DB count (not full sync - just check for updates)
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const refresh = async () => {
        if (isMountedRef.current) {
          const count = await getDbRecordCount();
          setSyncStatus(prev => {
            // If count increased, update and notify
            if (count > (prev.dbRecordCount || 0)) {
              const newOrders = count - (prev.dbRecordCount || 0);
              if (newOrders > 0 && onNewOrdersDetected) {
                onNewOrdersDetected(newOrders);
              }
            }
            return { ...prev, dbRecordCount: count };
          });
        }
      };

      autoRefreshRef.current = setInterval(refresh, autoRefreshInterval);
      
      return () => {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current);
        }
      };
    }
  }, [autoRefreshInterval, onNewOrdersDetected]);

  // Update DB count manually
  const refreshDbCount = useCallback(async () => {
    const count = await getDbRecordCount();
    if (isMountedRef.current) {
      setSyncStatus(prev => ({ ...prev, dbRecordCount: count }));
    }
    return count;
  }, []);

  // Check for new orders (compares current DB count with stored count)
  const checkForNewOrders = useCallback(async (): Promise<number> => {
    const currentCount = await getDbRecordCount();
    const prevCount = syncStatus.dbRecordCount || 0;
    
    if (currentCount > prevCount) {
      const newOrders = currentCount - prevCount;
      if (isMountedRef.current) {
        setSyncStatus(prev => ({ ...prev, dbRecordCount: currentCount }));
      }
      return newOrders;
    }
    
    return 0;
  }, [syncStatus.dbRecordCount]);

  return {
    syncStatus,
    syncOrders,
    syncOrdersFull, // Force full sync
    refreshDbCount,
    checkForNewOrders,
    isLoading: syncStatus.status === 'syncing' || syncStatus.status === 'retrying',
  };
};
