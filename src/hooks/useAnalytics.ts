import { useState, useCallback } from 'react';
import { AnalyticsData, Store, DateRange } from '@/types/analytics';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const STORES_API_URL = "https://shopify.kvatt.com/api/get-stores";
const ANALYTICS_API_URL = "https://shopify.kvatt.com/api/get-alaytics";
const AUTH_TOKEN = "Bearer %^75464tnfsdhndsfbgr54";

// Store name mapping from CSV - maps Shopify domain to friendly store name
const STORE_NAME_MAPPING: Record<string, string> = {
  'kvatt-green-package-demo.myshopify.com': 'Kvatt Green Package Demo',
  'toast-dev.myshopify.com': 'TOAST DEV',
  'universalworks.myshopify.com': 'Universal Works',
  'toast-newdev.myshopify.com': 'TOAST NEW DEV',
  'toast-newdev-us.myshopify.com': 'TOAST NEW DEV USD',
  'toast-dev-us.myshopify.com': 'TOAST DEV USD',
  'kvatt-dev.myshopify.com': 'KVATT DEV',
  'toast-uk.myshopify.com': 'TOAST',
  'sirplus.myshopify.com': 'SIRPLUS',
  'smitg-kvatt-demo.myshopify.com': 'Kvatt - Demo Store',
  'smit-v2.myshopify.com': 'smit-v2',
  'kvatt-test-gb.myshopify.com': 'Kvatt Test GB',
  'leming-kvatt-demo.myshopify.com': 'leming-kvatt-demo',
  'kapil-kvatt-checkout.myshopify.com': 'Kapil Kvatt Checkout',
  '6a86bd.myshopify.com': '6a86bd',
  'arkitaip.myshopify.com': 'Arkitaip',
};

// Former stores no longer returned by the stores API, kept for historical data.
// Maps Shopify domain -> store id in saved orders (imported_orders.user_id).
const HISTORICAL_STORES: Record<string, string> = {
  'toast-uk.myshopify.com': '12',
  'sirplus.myshopify.com': '17',
};
const HISTORICAL_STORE_DOMAINS = Object.keys(HISTORICAL_STORES);

// Fill in former stores from saved orders when the live API has no data for them
async function appendHistoricalStores(
  data: AnalyticsData[],
  dateRange: DateRange | undefined,
  storeId: string,
): Promise<AnalyticsData[]> {
  const present = new Set(data.filter(d => d.total_checkouts > 0 || d.opt_ins > 0).map(d => d.store));
  const missing = HISTORICAL_STORE_DOMAINS.filter(
    d => !present.has(d) && (storeId === 'all' || storeId === d),
  );
  if (!missing.length) return data;
  try {
    const { data: stats, error } = await supabase.rpc('get_store_stats', {
      store_filter: missing.map(d => HISTORICAL_STORES[d]),
      date_from: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd'T'00:00:00") : null,
      date_to: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd'T'23:59:59") : null,
    } as any);
    if (error) throw error;
    const extra: AnalyticsData[] = missing.map(domain => {
      const row = (stats || []).find((s: any) => String(s.store_id) === HISTORICAL_STORES[domain]);
      const total = Number(row?.total_orders) || 0;
      const optIns = Number(row?.opt_in_count) || 0;
      return { store: domain, total_checkouts: total, opt_ins: optIns, opt_outs: total - optIns };
    }).filter(r => r.total_checkouts > 0);
    return [...data.filter(d => !missing.includes(d.store)), ...extra];
  } catch (e) {
    console.error('Failed to load historical store data:', e);
    return data;
  }
}

// Dev/test/demo stores to exclude from production analytics (not A/B testing)
export const DEV_TEST_STORE_DOMAINS = new Set([
  'kvatt-green-package-demo.myshopify.com',
  'toast-dev.myshopify.com',
  'toast-newdev.myshopify.com',
  'toast-newdev-us.myshopify.com',
  'toast-dev-us.myshopify.com',
  'kvatt-dev.myshopify.com',
  'smitg-kvatt-demo.myshopify.com',
  'smit-v2.myshopify.com',
  'kvatt-test-gb.myshopify.com',
  'leming-kvatt-demo.myshopify.com',
  'kapil-kvatt-checkout.myshopify.com',
  '6a86bd.myshopify.com',
]);

// Check if a store domain is a dev/test store
export const isDevTestStore = (domain: string): boolean => DEV_TEST_STORE_DOMAINS.has(domain);

// Dev/test store IDs (numeric) used in imported_orders/get-store-mapping
export const DEV_TEST_STORE_IDS = new Set([
  '1', '5', '6', '8', '9', '10', '11', '20', '23', '24', '25', '26', '28', '29',
]);

// Check if a store ID (numeric) is a dev/test store
export const isDevTestStoreId = (storeId: string): boolean => DEV_TEST_STORE_IDS.has(storeId);

// Get display store name from store domain
export const getDisplayStoreName = (storeDomain: string): string => {
  return STORE_NAME_MAPPING[storeDomain] || storeDomain.replace('.myshopify.com', '');
};

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
      
      const liveDomains: string[] = result.status === 200 && Array.isArray(result.data) ? result.data : [];
      // Include former stores so their historical data remains viewable
      const allDomains = Array.from(new Set([...liveDomains, ...HISTORICAL_STORE_DOMAINS]));
      const storesList: Store[] = allDomains
        .filter((storeDomain: string) => !isDevTestStore(storeDomain))
        .map((storeDomain: string) => ({
          id: storeDomain,
          name: getDisplayStoreName(storeDomain)
        }));
      setStores(storesList);
      return storesList;
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
        // Filter out dev/test stores from production analytics
        const filteredData = result.data.filter(
          (item: AnalyticsData) => !isDevTestStore(item.store)
        );

        // Check if all data has zero values
        const hasActualData = filteredData.some(
          (item: AnalyticsData) => 
            item.total_checkouts > 0 || item.opt_ins > 0 || item.opt_outs > 0
        );

        if (!hasActualData) {
          console.log("No actual analytics data found, sending notification...");
          await sendFailureNotification(dateRange, storeId, "All stores returned zero data");
        }

        const withHistorical = await appendHistoricalStores(filteredData, dateRange, storeId);
        setData(withHistorical);
        return withHistorical;
      } else {
        // No data returned - send notification
        console.log("Analytics API returned no data, sending notification...");
        await sendFailureNotification(dateRange, storeId, "API returned empty data array");
        const historicalOnly = await appendHistoricalStores([], dateRange, storeId);
        setData(historicalOnly);
        return historicalOnly;
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
