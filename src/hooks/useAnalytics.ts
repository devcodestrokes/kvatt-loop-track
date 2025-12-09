import { useState, useCallback } from 'react';
import { AnalyticsData, Store, DateRange } from '@/types/analytics';
import { format } from 'date-fns';

const STORES_API_URL = "https://shopify.kvatt.com/api/get-stores";
const ANALYTICS_API_URL = "https://shopify.kvatt.com/api/get-alaytics";
const AUTH_TOKEN = "Bearer %^75464tnfsdhndsfbgr54";

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const storesList: Store[] = [
          { id: "all", name: "All Stores" },
          ...result.data.map((storeDomain: string) => ({
            id: storeDomain,
            name: storeDomain.replace('.myshopify.com', '')
          }))
        ];
        setStores(storesList);
        return storesList;
      }
      
      setStores([{ id: "all", name: "All Stores" }]);
      return [{ id: "all", name: "All Stores" }];
    } catch (err) {
      console.error("Error fetching stores:", err);
      setStores([{ id: "all", name: "All Stores" }]);
      return [{ id: "all", name: "All Stores" }];
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
        setData(result.data);
        return result.data;
      } else {
        setData([]);
        return [];
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
      setData([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    if (totals.totalCheckouts === 0) return 0;
    return ((totals.totalOptIns / totals.totalCheckouts) * 100).toFixed(1);
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
