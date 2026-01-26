import { useState, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';

const ANALYTICS_API_URL = "https://shopify.kvatt.com/api/get-alaytics";
const AUTH_TOKEN = "Bearer %^75464tnfsdhndsfbgr54";

interface DailyDataResult {
  checkouts: number;
  optIns: number;
  optOuts: number;
}

interface CacheEntry {
  data: DailyDataResult;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export function useBatchDailyData(selectedStores: string[], allStores: string[]) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const pendingRequestsRef = useRef<Map<string, Promise<DailyDataResult>>>(new Map());

  const getCacheKey = useCallback((date: Date, stores: string[]) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const storeKey = stores.length === 0 || stores.length === allStores.length 
      ? 'all' 
      : stores.sort().join(',');
    return `${dateStr}-${storeKey}`;
  }, [allStores.length]);

  const isValidCache = useCallback((entry: CacheEntry | undefined) => {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL;
  }, []);

  const fetchSingleDay = useCallback(async (date: Date): Promise<DailyDataResult> => {
    const cacheKey = getCacheKey(date, selectedStores);
    
    // Check cache first
    const cached = cacheRef.current.get(cacheKey);
    if (isValidCache(cached)) {
      return cached!.data;
    }

    // Check if request is already pending
    const pending = pendingRequestsRef.current.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Create new request
    const dateStr = format(date, 'yyyy-MM-dd');
    const requestPromise = (async () => {
      try {
        const url = `${ANALYTICS_API_URL}?store=all&start_date=${dateStr}&end_date=${dateStr}`;
        const response = await fetch(url, {
          headers: {
            "Authorization": AUTH_TOKEN,
            "Content-Type": "application/json",
            "Accept": "application/json"
          }
        });
        const result = await response.json();
        
        let data: DailyDataResult = { checkouts: 0, optIns: 0, optOuts: 0 };
        
        if (result.status === 200 && result.data?.length) {
          const filtered = selectedStores.length > 0 && selectedStores.length !== allStores.length
            ? result.data.filter((item: any) => selectedStores.includes(item.store))
            : result.data;
          
          data = filtered.reduce(
            (acc: DailyDataResult, item: any) => ({
              checkouts: acc.checkouts + (item.total_checkouts || 0),
              optIns: acc.optIns + (item.opt_ins || 0),
              optOuts: acc.optOuts + (item.opt_outs || 0),
            }),
            { checkouts: 0, optIns: 0, optOuts: 0 }
          );
        }
        
        // Store in cache
        cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      } catch {
        return { checkouts: 0, optIns: 0, optOuts: 0 };
      } finally {
        pendingRequestsRef.current.delete(cacheKey);
      }
    })();

    pendingRequestsRef.current.set(cacheKey, requestPromise);
    return requestPromise;
  }, [selectedStores, allStores.length, getCacheKey, isValidCache]);

  // Batch fetch for a week - fetches all 7 days in parallel
  const fetchWeekData = useCallback(async (weekStart: Date) => {
    const promises = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      // Skip future dates
      if (date > new Date()) {
        return Promise.resolve({ checkouts: 0, optIns: 0, optOuts: 0 });
      }
      return fetchSingleDay(date);
    });

    return Promise.all(promises);
  }, [fetchSingleDay]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    fetchDailyData: fetchSingleDay,
    fetchWeekData,
    clearCache,
  };
}
