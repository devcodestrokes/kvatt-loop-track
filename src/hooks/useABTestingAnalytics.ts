import { useState, useCallback } from 'react';
import { Store, DateRange } from '@/types/analytics';
import { format } from 'date-fns';
import { getDisplayStoreName } from '@/hooks/useAnalytics';

const STORES_API_URL = "https://kvatt-v2.deveshasolution.com/api/get-stores";
const ANALYTICS_API_URL = "https://kvatt-v2.deveshasolution.com/api/get-alaytics";
const AUTH_TOKEN = "Bearer %^75464tnfsdhndsfbgr54";

export interface ABTestingData {
  store: string;
  total_checkouts: number;
  opt_ins: number;
  opt_outs: number;
  ab_testing_checkout: number;
  ab_testing_opt_in: number;
  ab_testing_opt_out: number;
}

export function useABTestingAnalytics() {
  const [data, setData] = useState<ABTestingData[]>([]);
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
        const storesList: Store[] = result.data.map((storeDomain: string) => ({
          id: storeDomain,
          name: getDisplayStoreName(storeDomain)
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

  return {
    data,
    stores,
    isLoading,
    error,
    fetchStores,
    fetchAnalytics,
  };
}
