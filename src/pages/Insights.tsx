import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Lightbulb, TrendingUp, TrendingDown, Minus, Package, Users, Recycle, Target, 
  RefreshCw, Brain, MapPin, Clock, ShoppingCart, Store, Zap,
  Database, Calendar, Smartphone, Monitor, ShoppingBag,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { Progress } from '@/components/ui/progress';
import { MultiStoreSelector } from '@/components/dashboard/MultiStoreSelector';
import { InsightsChatbot } from '@/components/dashboard/InsightsChatbot';
import { ApiSyncStatus } from '@/components/dashboard/ApiSyncStatus';

import { useStoreFilter } from '@/hooks/useStoreFilter';
import { useApiSync } from '@/hooks/useApiSync';
import { Store as StoreType } from '@/types/analytics';

interface Insight {
  id: string;
  merchant_id: string | null;
  merchant_name?: string;
  insight_type: string;
  title: string;
  description: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  metadata: Record<string, any>;
  created_at: string;
}

interface CROAnalysis {
  keyFindings?: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    dataPoint: string;
  }>;
  demographicPatterns?: {
    summary: string;
    topLocations: string[];
    recommendation: string;
  };
  behavioralPatterns?: {
    orderValueInsight: string;
    productPreferences: string;
    timingInsights: string;
  };
  storeAnalysis?: {
    topPerformers: string[];
    underperformers: string[];
    recommendation: string;
  };
  actionableRecommendations?: Array<{
    priority: number;
    action: string;
    expectedImpact: string;
    implementation: string;
  }>;
  predictedOptInIncrease?: string;
  rawAnalysis?: string;
}

interface OrderAnalytics {
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
    bestCitiesByOptIn: Array<{ name: string; total: number; optIn: number; optInRate: string }>;
    topCountries: Array<{ name: string; total: number; optIn: number; optInRate: string; avgOrderValue: string }>;
    topProvinces: Array<{ name: string; total: number; optIn: number; optInRate: string }>;
  };
  stores: Array<{
    storeId: string;
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

const insightTypeIcons: Record<string, React.ReactNode> = {
  return_rate: <Recycle className="h-5 w-5" />,
  opt_in_rate: <Target className="h-5 w-5" />,
  package_usage: <Package className="h-5 w-5" />,
  customer_engagement: <Users className="h-5 w-5" />,
  default: <Lightbulb className="h-5 w-5" />,
};

const trendIcons = {
  up: <TrendingUp className="h-4 w-4 text-primary" />,
  down: <TrendingDown className="h-4 w-4 text-destructive" />,
  stable: <Minus className="h-4 w-4 text-muted-foreground" />,
};

const trendColors = {
  up: 'text-primary bg-primary/10',
  down: 'text-destructive bg-destructive/10',
  stable: 'text-muted-foreground bg-muted',
};

const impactColors = {
  high: 'bg-primary text-primary-foreground',
  medium: 'bg-amber-500 text-white',
  low: 'bg-muted text-muted-foreground',
};

const STORAGE_KEYS = {
  ORDER_ANALYTICS: 'kvatt_order_analytics',
  CRO_ANALYSIS: 'kvatt_cro_analysis',
  LAST_ANALYZED: 'kvatt_last_analyzed',
};

const loadFromStorage = <T,>(key: string): T | null => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
};

const AUTO_REFRESH_INTERVAL = 60000; // 1 minute auto-refresh

const Insights = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  
  
  // CRO Analysis state - load from storage initially
  const [orderAnalytics, setOrderAnalytics] = useState<OrderAnalytics | null>(() => 
    loadFromStorage<OrderAnalytics>(STORAGE_KEYS.ORDER_ANALYTICS)
  );
  const [croAnalysis, setCroAnalysis] = useState<CROAnalysis | null>(() => 
    loadFromStorage<CROAnalysis>(STORAGE_KEYS.CRO_ANALYSIS)
  );
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(() => 
    localStorage.getItem(STORAGE_KEYS.LAST_ANALYZED)
  );
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  // Handle new orders detected - refresh analytics
  const handleNewOrdersDetected = useCallback((newCount: number) => {
    toast.info(`${newCount} new orders detected - refreshing analytics...`);
    // Trigger analytics refresh
    analyzeExistingData(true);
  }, []);

  // Handle sync complete - update analytics
  const handleSyncComplete = useCallback(async (data: any) => {
    // Analyze the imported orders data
    const { data: analyticsData, error: analyticsError } = await supabase.functions.invoke('analyze-imported-orders');
    
    if (!analyticsError && analyticsData?.data) {
      setOrderAnalytics(analyticsData.data);
      saveToStorage(STORAGE_KEYS.ORDER_ANALYTICS, analyticsData.data);
      const now = new Date().toISOString();
      setLastAnalyzed(now);
      localStorage.setItem(STORAGE_KEYS.LAST_ANALYZED, now);
    }
  }, []);

  // Use API sync hook with retry logic
  const { syncStatus, syncOrders, refreshDbCount, isLoading: isSyncing } = useApiSync({
    maxRetries: 5,
    baseDelayMs: 2000,
    maxDelayMs: 60000,
    onNewOrdersDetected: handleNewOrdersDetected,
    onSyncComplete: handleSyncComplete,
  });

  // Derive stores from orderAnalytics for filtering
  const availableStores = useMemo((): StoreType[] => {
    if (!orderAnalytics?.stores) return [];
    return orderAnalytics.stores.map(s => {
      // Extract clean store name by removing .myshopify.com suffix
      const cleanName = s.storeId.replace('.myshopify.com', '');
      // Capitalize and format the store name nicely
      const formattedName = cleanName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return {
        id: s.storeId,
        name: formattedName
      };
    });
  }, [orderAnalytics?.stores]);

  const {
    selectedStores,
    toggleStore,
    selectAll,
    unselectAll,
  } = useStoreFilter(availableStores);

  // Filter store analytics by selected stores
  const filteredStoreAnalytics = useMemo(() => {
    if (!orderAnalytics?.stores) return [];
    if (selectedStores.length === 0 || selectedStores.length === availableStores.length) {
      return orderAnalytics.stores;
    }
    return orderAnalytics.stores.filter(s => selectedStores.includes(s.storeId));
  }, [orderAnalytics?.stores, selectedStores, availableStores.length]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('insights')
        .select(`
          *,
          merchants (name)
        `)
        .order('created_at', { ascending: false });

      if (selectedMerchant !== 'all') {
        query = query.eq('merchant_id', selectedMerchant);
      }

      const { data: insightsResult, error } = await query;
      if (error) throw error;

      const formattedInsights = (insightsResult || []).map((i: any) => ({
        ...i,
        merchant_name: i.merchants?.name || 'All Merchants',
        metadata: typeof i.metadata === 'string' ? JSON.parse(i.metadata) : i.metadata || {},
      }));

      setInsights(formattedInsights);

      const { data: merchantResult } = await supabase.from('merchants').select('id, name');
      setMerchants(merchantResult || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast.error('Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  };


  const fetchOrderAnalytics = async () => {
    setIsFetchingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-order-data');
      
      if (error) throw error;
      
      if (data?.data) {
        setOrderAnalytics(data.data);
        saveToStorage(STORAGE_KEYS.ORDER_ANALYTICS, data.data);
        const now = new Date().toISOString();
        setLastAnalyzed(now);
        localStorage.setItem(STORAGE_KEYS.LAST_ANALYZED, now);
        toast.success(`Analyzed ${data.data.summary.totalOrders.toLocaleString()} checkouts from Shopify`);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error fetching order analytics:', error);
      toast.error(error.message || 'Failed to analyze order data');
    } finally {
      setIsFetchingData(false);
    }
  };


  const runCROAnalysis = async () => {
    if (!orderAnalytics) {
      toast.error('Please analyze order data first');
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-cro-patterns', {
        body: { analyticsData: orderAnalytics }
      });
      
      if (error) throw error;
      
      if (data?.data?.analysis) {
        setCroAnalysis(data.data.analysis);
        saveToStorage(STORAGE_KEYS.CRO_ANALYSIS, data.data.analysis);
        const now = new Date().toISOString();
        setLastAnalyzed(now);
        localStorage.setItem(STORAGE_KEYS.LAST_ANALYZED, now);
        toast.success('CRO analysis complete');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error running CRO analysis:', error);
      toast.error(error.message || 'Failed to run CRO analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Analyze existing data from database (doesn't require external API)
  const analyzeExistingData = async (showToast = false) => {
    if (isFetchingData || isAutoRefreshing) return;
    
    setIsAutoRefreshing(true);
    try {
      // Analyze data already in the database - no external API call needed
      const { data: analyticsData, error: analyticsError } = await supabase.functions.invoke('analyze-imported-orders');
      
      if (analyticsError) {
        console.error('Analysis error:', analyticsError);
        return;
      }
      
      if (analyticsData?.success && analyticsData?.data) {
        const prevTotal = orderAnalytics?.summary?.totalOrders || 0;
        const newTotal = analyticsData.data.summary.totalOrders || 0;
        
        setOrderAnalytics(analyticsData.data);
        saveToStorage(STORAGE_KEYS.ORDER_ANALYTICS, analyticsData.data);
        const now = new Date().toISOString();
        setLastAnalyzed(now);
        localStorage.setItem(STORAGE_KEYS.LAST_ANALYZED, now);
        
        // Only show toast if there's new data and showToast is true
        if (showToast && newTotal > prevTotal) {
          toast.success(`${newTotal - prevTotal} new orders detected`);
        }
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
    } finally {
      setIsAutoRefreshing(false);
    }
  };

  // Initial data fetch and auto-refresh setup
  useEffect(() => {
    fetchData();
    
    // Analyze existing data on mount (doesn't call external API)
    analyzeExistingData(false);
    
    // Update DB count on mount
    refreshDbCount();
    
    // Set up auto-refresh interval to re-analyze database data
    const intervalId = setInterval(() => {
      analyzeExistingData(true);
      refreshDbCount();
    }, AUTO_REFRESH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedMerchant]);

  const formatStoreName = (storeId: string) => {
    return `Store ${storeId}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive CRO analytics and opt-in pattern analysis
          </p>
        </div>
        {availableStores.length > 0 && (
          <MultiStoreSelector
            stores={availableStores}
            selectedStores={selectedStores}
            onToggleStore={toggleStore}
            onSelectAll={selectAll}
            onUnselectAll={unselectAll}
          />
        )}
      </div>

      <div className="space-y-6">
          {/* API Sync Status Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ApiSyncStatus syncStatus={syncStatus} />
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isAutoRefreshing && (
                <span className="flex items-center gap-1 text-primary">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Auto-syncing...
                </span>
              )}
              <span className="text-xs text-muted-foreground/60">
                • Auto-refresh: 1 min
              </span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant="outline"
              disabled={isSyncing || isFetchingData || isAutoRefreshing}
              onClick={() => syncOrders(true)}
            >
              <Database className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Orders'}
            </Button>
            <Button 
              onClick={runCROAnalysis} 
              disabled={!orderAnalytics || isAnalyzing}
            >
              <Brain className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-pulse' : ''}`} />
              {isAnalyzing ? 'Analyzing...' : 'Run AI CRO Analysis'}
            </Button>
            {lastAnalyzed && !isAutoRefreshing && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Analytics updated: {new Date(lastAnalyzed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {/* Summary Cards */}
          {orderAnalytics && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                </div>
                <p className="text-3xl font-bold">{orderAnalytics.summary.totalOrders.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {orderAnalytics.summary.totalOptIns.toLocaleString()} opt-ins
                </p>
              </div>
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Opt-In Rate</span>
                </div>
                <p className="text-3xl font-bold text-primary">{orderAnalytics.summary.optInRate}%</p>
                <div className="mt-2">
                  <Progress value={parseFloat(orderAnalytics.summary.optInRate)} className="h-2" />
                </div>
              </div>
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Avg Opt-In Order</span>
                </div>
                <p className="text-3xl font-bold">£{orderAnalytics.summary.avgOptInOrderValue}</p>
              </div>
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingDown className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg Opt-Out Order</span>
                </div>
                <p className="text-3xl font-bold">£{orderAnalytics.summary.avgOptOutOrderValue}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Difference: £{orderAnalytics.summary.valueDifference}
                </p>
              </div>
            </div>
          )}

          {/* Key Insights from Data */}
          {orderAnalytics && orderAnalytics.insights.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Key Insights
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {orderAnalytics.insights.map((insight, i) => (
                  <div key={i} className="metric-card">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${impactColors[insight.impact]}`}>
                        {insight.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                    <h3 className="font-semibold mb-2">{insight.title}</h3>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CRO Analysis Parameters */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              CRO Analysis Parameters
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">
                Available Data
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Temporal Patterns */}
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Temporal Patterns</h3>
                    <p className="text-xs text-muted-foreground">Day & month trends</p>
                  </div>
                </div>
                {orderAnalytics?.temporal?.byDayOfWeek && orderAnalytics.temporal.byDayOfWeek.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const bestDay = [...orderAnalytics.temporal.byDayOfWeek].sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))[0];
                      const worstDay = [...orderAnalytics.temporal.byDayOfWeek].sort((a, b) => parseFloat(a.optInRate) - parseFloat(b.optInRate))[0];
                      return (
                        <>
                          <div className="flex items-center justify-between p-2 rounded bg-primary/5 border border-primary/20">
                            <span className="text-sm">Best: {bestDay.day}</span>
                            <span className="text-sm font-bold text-primary">{bestDay.optInRate}%</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="text-sm">Lowest: {worstDay.day}</span>
                            <span className="text-sm text-muted-foreground">{worstDay.optInRate}%</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Run analysis to see patterns
                  </div>
                )}
              </div>

              {/* Order Value Segments */}
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Value Segments</h3>
                    <p className="text-xs text-muted-foreground">Order price analysis</p>
                  </div>
                </div>
                {orderAnalytics?.orderValueAnalysis && orderAnalytics.orderValueAnalysis.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const bestRange = [...orderAnalytics.orderValueAnalysis]
                        .filter(r => r.total >= 100)
                        .sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))[0];
                      return bestRange ? (
                        <>
                          <div className="flex items-center justify-between p-2 rounded bg-primary/5 border border-primary/20">
                            <span className="text-sm">Best: {bestRange.range}</span>
                            <span className="text-sm font-bold text-primary">{bestRange.optInRate}%</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <span className="text-sm">Opt-ins in range</span>
                            <span className="text-sm text-muted-foreground">{bestRange.optIns.toLocaleString()}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Analyzing...</p>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Run analysis to see segments
                  </div>
                )}
              </div>

              {/* Monthly Trends */}
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Monthly Trends</h3>
                    <p className="text-xs text-muted-foreground">Month-over-month</p>
                  </div>
                </div>
                {orderAnalytics?.temporal?.byMonth && orderAnalytics.temporal.byMonth.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const recentMonths = orderAnalytics.temporal.byMonth.slice(-2);
                      const currentMonth = recentMonths[recentMonths.length - 1];
                      const prevMonth = recentMonths.length > 1 ? recentMonths[0] : null;
                      const trend = prevMonth 
                        ? parseFloat(currentMonth.optInRate) - parseFloat(prevMonth.optInRate) 
                        : 0;
                      return (
                        <>
                          <div className="flex items-center justify-between p-2 rounded bg-primary/5 border border-primary/20">
                            <span className="text-sm">{currentMonth.month}</span>
                            <span className="text-sm font-bold text-primary">{currentMonth.optInRate}%</span>
                          </div>
                          {prevMonth && (
                            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                              <span className="text-sm">vs prev month</span>
                              <span className={`text-sm font-medium ${trend > 0 ? 'text-primary' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {trend > 0 ? '+' : ''}{trend.toFixed(2)}%
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Run analysis to see trends
                  </div>
                )}
              </div>

              {/* Payment Status */}
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Conversion Quality</h3>
                    <p className="text-xs text-muted-foreground">Opt-in vs opt-out</p>
                  </div>
                </div>
                {orderAnalytics?.summary ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-primary/5 border border-primary/20">
                      <span className="text-sm">Opt-in orders</span>
                      <span className="text-sm font-bold text-primary">{orderAnalytics.summary.totalOptIns.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span className="text-sm">Value uplift</span>
                      <span className={`text-sm font-medium ${parseFloat(orderAnalytics.summary.valueDifference) > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        +£{orderAnalytics.summary.valueDifference}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Run analysis to see data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Availability Notice */}
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-sm mb-1">Data Parameters Available for CRO Analysis</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">✓ Order Value</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">✓ Opt-in Status</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">✓ Temporal (Day/Month)</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">✓ Payment Status</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">✓ Geographic (City/Region/Country)</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">○ Device Type (not tracked)</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">○ Basket Items (requires line items)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Value Analysis */}
          {orderAnalytics && orderAnalytics.orderValueAnalysis.length > 0 && (
            <div className="metric-card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Opt-In Rate by Order Value
              </h2>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order Value Range</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Opt-Ins</th>
                      <th className="text-right">Opt-In Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderAnalytics.orderValueAnalysis.map((range, i) => (
                      <tr key={i}>
                        <td className="font-medium">{range.range}</td>
                        <td className="text-right text-muted-foreground">{range.total.toLocaleString()}</td>
                        <td className="text-right text-primary">{range.optIns.toLocaleString()}</td>
                        <td className="text-right">
                          <span className={`font-semibold ${parseFloat(range.optInRate) > 10 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {range.optInRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Store Performance */}
          {filteredStoreAnalytics.length > 0 && (
            <div className="metric-card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Store Performance
              </h2>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Opt-Ins</th>
                      <th className="text-right">Opt-In Rate</th>
                      <th className="text-right">Avg Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStoreAnalytics.slice(0, 15).map((store, i) => (
                      <tr key={i}>
                        <td className="font-medium">{formatStoreName(store.storeId)}</td>
                        <td className="text-right text-muted-foreground">{store.total.toLocaleString()}</td>
                        <td className="text-right text-primary">{store.optIn.toLocaleString()}</td>
                        <td className="text-right">
                          <span className={`font-semibold ${parseFloat(store.optInRate) > 10 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {store.optInRate}%
                          </span>
                        </td>
                        <td className="text-right">£{store.avgOrderValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Geographic Analysis */}
          {orderAnalytics && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Top Cities */}
              <div className="metric-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Top Cities
                </h2>
                {orderAnalytics.geographic.bestCitiesByOptIn && orderAnalytics.geographic.bestCitiesByOptIn.length > 0 ? (
                  <div className="space-y-2">
                    {orderAnalytics.geographic.bestCitiesByOptIn.slice(0, 8).map((city, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm font-medium truncate max-w-[140px]" title={city.name}>{city.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{city.total.toLocaleString()}</span>
                          <span className={`text-sm font-bold ${parseFloat(city.optInRate) > 15 ? 'text-primary' : ''}`}>
                            {city.optInRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No city data yet</p>
                    <p className="text-xs mt-1">Sync orders to load geographic data</p>
                  </div>
                )}
              </div>

              {/* Top Provinces/Regions */}
              <div className="metric-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Top Regions
                </h2>
                {orderAnalytics.geographic.topProvinces && orderAnalytics.geographic.topProvinces.length > 0 ? (
                  <div className="space-y-2">
                    {orderAnalytics.geographic.topProvinces.slice(0, 8).map((province, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm font-medium truncate max-w-[140px]" title={province.name}>{province.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{province.total.toLocaleString()}</span>
                          <span className={`text-sm font-bold ${parseFloat(province.optInRate) > 10 ? 'text-primary' : ''}`}>
                            {province.optInRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No region data yet</p>
                    <p className="text-xs mt-1">Sync orders to load geographic data</p>
                  </div>
                )}
              </div>

              {/* Top Countries */}
              <div className="metric-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Top Countries
                </h2>
                {orderAnalytics.geographic.topCountries && orderAnalytics.geographic.topCountries.length > 0 ? (
                  <div className="space-y-2">
                    {orderAnalytics.geographic.topCountries.slice(0, 8).map((country, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm font-medium truncate max-w-[140px]" title={country.name}>{country.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{country.total.toLocaleString()}</span>
                          <span className={`text-sm font-bold ${parseFloat(country.optInRate) > 10 ? 'text-primary' : ''}`}>
                            {country.optInRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No country data yet</p>
                    <p className="text-xs mt-1">Sync orders to load geographic data</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Monthly Opt-In Trend */}
          {orderAnalytics && orderAnalytics.temporal.byMonth && orderAnalytics.temporal.byMonth.length > 0 && (
            <div className="metric-card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Monthly Opt-In Trend
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {orderAnalytics.temporal.byMonth.slice(-8).map((month, i) => {
                  const monthName = new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'short' });
                  const isHighest = month.optInRate === Math.max(...orderAnalytics.temporal.byMonth.slice(-8).map(m => parseFloat(m.optInRate))).toFixed(2);
                  return (
                    <div key={i} className={`text-center p-3 rounded ${isHighest ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'}`}>
                      <p className="text-xs text-muted-foreground mb-1">{monthName}</p>
                      <p className={`text-lg font-bold ${isHighest ? 'text-primary' : ''}`}>
                        {month.optInRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">{month.total.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Temporal Analysis */}
          {orderAnalytics && orderAnalytics.temporal.byDayOfWeek.length > 0 && (
            <div className="metric-card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Opt-In Rate by Day of Week
              </h2>
              <div className="grid grid-cols-7 gap-2">
                {orderAnalytics.temporal.byDayOfWeek.map((day, i) => (
                  <div key={i} className="text-center p-3 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">{day.day.slice(0, 3)}</p>
                    <p className={`text-lg font-bold ${parseFloat(day.optInRate) > 10 ? 'text-primary' : ''}`}>
                      {day.optInRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">{day.total.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI CRO Analysis Results */}
          {croAnalysis && (
            <div className="space-y-6">
              {croAnalysis.keyFindings && croAnalysis.keyFindings.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    AI Key Findings
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {croAnalysis.keyFindings.map((finding, i) => (
                      <div key={i} className="metric-card">
                        <div className="flex items-start justify-between mb-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${impactColors[finding.impact]}`}>
                            {finding.impact.toUpperCase()} IMPACT
                          </span>
                        </div>
                        <h3 className="font-semibold mb-2">{finding.title}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{finding.description}</p>
                        <p className="text-xs text-primary font-medium">{finding.dataPoint}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {croAnalysis.rawAnalysis && !croAnalysis.keyFindings && (
                <div className="metric-card">
                  <h2 className="text-lg font-semibold mb-4">AI Analysis</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">{croAnalysis.rawAnalysis}</p>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!orderAnalytics && !isFetchingData && (
            <div className="text-center py-12">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
              <p className="text-muted-foreground mb-4">
                Click "Fetch Shopify Data" to analyze checkout data from all stores.
              </p>
            </div>
          )}
        </div>


      {/* Read-only Metrics Chatbot */}
      <InsightsChatbot />
    </div>
  );
};

export default Insights;
