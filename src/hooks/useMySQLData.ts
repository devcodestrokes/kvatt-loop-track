import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MySQLResponse<T> {
  status: number;
  data?: T;
  error?: string;
}

export function useMySQLData() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useCallback(async <T>(action: string, params?: Record<string, any>): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<MySQLResponse<T>>('mysql-data', {
        body: { action, params }
      });
      
      if (invokeError) {
        throw new Error(invokeError.message);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      return data?.data || null;
    } catch (err: any) {
      const message = err.message || 'Failed to fetch data from MySQL';
      setError(message);
      console.error('MySQL query error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getMerchants = useCallback((limit?: number) => {
    return query<Merchant[]>('get_merchants', { limit });
  }, [query]);

  const getCustomers = useCallback((params?: { store_id?: string; limit?: number; offset?: number }) => {
    return query<Customer[]>('get_customers', params);
  }, [query]);

  const getOrders = useCallback((params?: { store_id?: string; limit?: number; offset?: number; opt_in_only?: boolean }) => {
    return query<Order[]>('get_orders', params);
  }, [query]);

  const getOrderAnalytics = useCallback(() => {
    return query<OrderAnalytics>('get_order_analytics');
  }, [query]);

  const getLineItems = useCallback((params?: { order_id?: string; limit?: number }) => {
    return query<LineItem[]>('get_line_items', params);
  }, [query]);

  const getProductAnalytics = useCallback(() => {
    return query<ProductAnalytics[]>('get_product_analytics');
  }, [query]);

  const getDashboardStats = useCallback(() => {
    return query<DashboardStats>('get_dashboard_stats');
  }, [query]);

  return {
    isLoading,
    error,
    query,
    getMerchants,
    getCustomers,
    getOrders,
    getOrderAnalytics,
    getLineItems,
    getProductAnalytics,
    getDashboardStats,
  };
}

// Types
export interface Merchant {
  id: string;
  name: string;
  shopifyDomain: string;
  email?: string;
  totalCheckouts: number;
  totalOptIns: number;
  optInRate: string;
  status: 'active' | 'pending' | 'inactive';
  createdAt?: string;
}

export interface Customer {
  id: string;
  user_id: string;
  shopify_customer_id?: string;
  name?: string;
  email?: string;
  telephone?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  shopify_order_id?: string;
  name?: string;
  opt_in: boolean | number;
  payment_status?: string;
  total_price: number;
  customer_id?: string;
  destination?: string;
  shopify_created_at?: string;
  created_at: string;
}

export interface LineItem {
  id: string;
  order_id: string;
  shopify_line_item_id?: string;
  shopify_product_id?: string;
  shopify_variant_id?: string;
  product_title: string;
  variant_title?: string;
  quantity: number;
  total_price: number;
  created_at: string;
}

export interface ProductAnalytics {
  productTitle: string;
  variantTitle?: string;
  totalQuantity: number;
  totalRevenue: string;
  orderCount: number;
  optInQuantity: number;
  optInRate: string;
}

export interface OrderAnalytics {
  summary: {
    totalOrders: number;
    totalOptIns: number;
    totalOptOuts: number;
    optInRate: string;
    avgOptInOrderValue: string;
    avgOptOutOrderValue: string;
    valueDifference: string;
  };
  orderValueAnalysis: Array<{
    range: string;
    total: number;
    optIns: number;
    optInRate: string;
  }>;
  geographic: {
    topCities: Array<{ name: string; total: number; optIn: number; optInRate: string; avgOrderValue: string }>;
    topCountries: Array<{ name: string; total: number; optIn: number; optInRate: string }>;
    topProvinces: Array<{ name: string; total: number; optIn: number; optInRate: string }>;
  };
  stores: Array<{
    storeId: string;
    name?: string;
    shopifyDomain?: string;
    total: number;
    optIn: number;
    optInRate: string;
    avgOrderValue: string;
    totalRevenue: string;
  }>;
  temporal: {
    byDayOfWeek: Array<{ day: string; dayNum: number; total: number; optIn: number; optInRate: string }>;
    byMonth: Array<{ month: string; total: number; optIn: number; optInRate: string }>;
  };
  insights: Array<{
    type: string;
    title: string;
    description: string;
    value: string;
    impact: 'high' | 'medium' | 'low';
  }>;
}

export interface DashboardStats {
  totalOrders: number;
  totalOptIns: number;
  optInRate: string;
  totalRevenue: string;
  totalCustomers: number;
  last30DaysOrders: number;
}
