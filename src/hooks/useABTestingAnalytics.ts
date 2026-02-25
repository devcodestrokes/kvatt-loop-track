import { useState, useCallback } from 'react';
import { Store, DateRange } from '@/types/analytics';
import { format } from 'date-fns';
import { getDisplayStoreName } from '@/hooks/useAnalytics';

const STORES_API_URL = "https://shopify.kvatt.com/api/get-stores";
const ANALYTICS_API_URL = "https://shopify.kvatt.com/api/get-alaytics";
const AUTH_TOKEN = "Bearer %^75464tnfsdhndsfbgr54";

export interface VariantData {
  name: string;
  total: number;
  opt_ins: number;
  opt_outs: number;
  opt_in_rate: number;
}

export interface ABTestingData {
  store: string;
  total_checkouts: number;
  opt_ins: number;
  opt_outs: number;
  ab_testing_checkout: number;
  ab_testing_opt_in: number;
  ab_testing_opt_out: number;
  variants: VariantData[];
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

  const parseVariants = (abTesting: any): VariantData[] => {
    if (!abTesting || typeof abTesting !== 'object') return [];
    
    const variants: VariantData[] = [];
    for (const [name, values] of Object.entries(abTesting)) {
      if (values && typeof values === 'object' && 'total' in (values as any)) {
        const v = values as { in?: number; out?: number; total?: number };
        const total = v.total || 0;
        const optIns = v.in || 0;
        const optOuts = v.out || 0;
        variants.push({
          name,
          total,
          opt_ins: optIns,
          opt_outs: optOuts,
          opt_in_rate: total > 0 ? (optIns / total) * 100 : 0,
        });
      }
    }
    return variants;
  };

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
        const parsed: ABTestingData[] = result.data.map((item: any) => {
          const ab = item.ab_testing || {};
          const variants = parseVariants(ab);
          
          // Sum variant totals for AB metrics
          const abCheckout = variants.reduce((sum, v) => sum + v.total, 0);
          const abOptIn = variants.reduce((sum, v) => sum + v.opt_ins, 0);
          const abOptOut = variants.reduce((sum, v) => sum + v.opt_outs, 0);

          return {
            store: item.store,
            total_checkouts: item.total_checkouts || 0,
            opt_ins: item.opt_ins || 0,
            opt_outs: item.opt_outs || 0,
            ab_testing_checkout: abCheckout > 0 ? abCheckout : (item.total_checkouts ?? 0),
            ab_testing_opt_in: abOptIn > 0 ? abOptIn : (item.opt_ins ?? 0),
            ab_testing_opt_out: abOptOut > 0 ? abOptOut : (item.opt_outs ?? 0),
            variants,
          };
        });
        setData(parsed);
        return parsed;
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
