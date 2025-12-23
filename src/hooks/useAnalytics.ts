import { useState, useCallback } from 'react';
import { AnalyticsData, Store, DateRange } from '@/types/analytics';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const STORES_API_URL = "https://shopify.kvatt.com/api/get-stores";
const ANALYTICS_API_URL = "https://shopify.kvatt.com/api/get-alaytics";
const AUTH_TOKEN = "Bearer %^75464tnfsdhndsfbgr54";

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendFailureNotification = useCallback(async (
    dateRange?: DateRange,
    storeId?: string,
    errorMessage?: string
  ) => {
    try {
      console.log("Sending analytics failure notification...");
      await supabase.functions.invoke('notify-analytics-failure', {
        body: {
          dateRange: dateRange ? {
            from: format(dateRange.from!, 'yyyy-MM-dd'),
            to: format(dateRange.to!, 'yyyy-MM-dd'),
          } : undefined,
          storeId,
          errorMessage,
        },
      });
      console.log("Failure notification sent successfully");
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  }, []);

  const fetchStores = useCallback(async () => {
    try {
      const response = await fetch(STORES_API_URL, {
        headers: {
          "Authorization": AUTH_TOKEN,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });
      
      const result = await response.json();
      
      if (result.status === 200 && result.data?.length) {
        // Don't include "all" option - multi-select handles this
        const storesList: Store[] = result.data.map((storeDomain: string) => ({
          id: storeDomain,
          name: storeDomain.replace('.myshopify.com', '')
        }));
        setStores(storesList);
        return storesList;
      }
      
      setStores([]);
      return [];
    } catch (err) {
      console.error("Error fetching stores:", err);
      setStores([]);
      return [];
    }
  }, []);

  const fetchAnalytics = useCallback(async (
    dateRange?: DateRange,
    storeId: string = "all"
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      let url = `${ANALYTICS_API_URL}?store=${encodeURIComponent(storeId)}`;
      
      if (dateRange?.from) {
        url += `&start_date=${format(dateRange.from, 'yyyy-MM-dd')}`;
      }
      if (dateRange?.to) {
        url += `&end_date=${format(dateRange.to, 'yyyy-MM-dd')}`;
      }

      const response = await fetch(url, {
        headers: {
          "Authorization": AUTH_TOKEN,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });

      const result = await response.json();

      if (result.status === 200 && result.data?.length) {
        // Check if all data has zero values
        const hasActualData = result.data.some(
          (item: AnalyticsData) => 
            item.total_checkouts > 0 || item.opt_ins > 0 || item.opt_outs > 0
        );

        if (!hasActualData) {
          console.log("No actual analytics data found, sending notification...");
          await sendFailureNotification(dateRange, storeId, "All stores returned zero data");
        }

        setData(result.data);
        return result.data;
      } else {
        // No data returned - send notification
        console.log("Analytics API returned no data, sending notification...");
        await sendFailureNotification(dateRange, storeId, "API returned empty data array");
        setData([]);
        return [];
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
      
      // Send notification on error
      console.log("Analytics fetch error, sending notification...");
      await sendFailureNotification(dateRange, storeId, errorMessage);
      
      setData([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [sendFailureNotification]);

  const getTotals = useCallback(() => {
    return data.reduce(
      (acc, item) => ({
        totalCheckouts: acc.totalCheckouts + (item.total_checkouts || 0),
        totalOptIns: acc.totalOptIns + (item.opt_ins || 0),
        totalOptOuts: acc.totalOptOuts + (item.opt_outs || 0),
      }),
      { totalCheckouts: 0, totalOptIns: 0, totalOptOuts: 0 }
    );
  }, [data]);

  const getOptInRate = useCallback(() => {
    const totals = getTotals();
    if (totals.totalCheckouts === 0) return '0.00';
    return ((totals.totalOptIns / totals.totalCheckouts) * 100).toFixed(2);
  }, [getTotals]);

  return {
    data,
    stores,
    isLoading,
    error,
    fetchStores,
    fetchAnalytics,
    getTotals,
    getOptInRate,
  };
}
