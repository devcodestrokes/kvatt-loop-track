import { useState, useEffect, useMemo } from 'react';
import { 
  Lightbulb, TrendingUp, TrendingDown, Minus, Package, Users, Recycle, Target, 
  RefreshCw, Brain, MapPin, Clock, ShoppingCart, Store, Zap,
  Database, Calendar, Smartphone, Monitor, ShoppingBag,
  BarChart3, Layers, Upload
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { MultiStoreSelector } from '@/components/dashboard/MultiStoreSelector';
import { InsightsChatbot } from '@/components/dashboard/InsightsChatbot';
import { CSVUploadAnalysis } from '@/components/dashboard/CSVUploadAnalysis';
import { useStoreFilter } from '@/hooks/useStoreFilter';
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

const Insights = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('shopify');
  
  // CRO Analysis state - load from storage initially
  const [orderAnalytics, setOrderAnalytics] = useState<OrderAnalytics | null>(() => 
    loadFromStorage<OrderAnalytics>(STORAGE_KEYS.ORDER_ANALYTICS)
  );
  const [croAnalysis, setCroAnalysis] = useState<CROAnalysis | null>(() => 
    loadFromStorage<CROAnalysis>(STORAGE_KEYS.CRO_ANALYSIS)
  );
  const [csvCroAnalysis, setCsvCroAnalysis] = useState<CROAnalysis | null>(() => 
    loadFromStorage<CROAnalysis>('kvatt_csv_cro_analysis')
  );
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(() => 
    localStorage.getItem(STORAGE_KEYS.LAST_ANALYZED)
  );
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Derive stores from orderAnalytics for filtering
  const availableStores = useMemo((): StoreType[] => {
    if (!orderAnalytics?.stores) return [];
    return orderAnalytics.stores.map(s => ({
      id: s.storeId,
      name: s.storeId.replace('.myshopify.com', '')
    }));
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="shopify" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Shopify Opt-In
          </TabsTrigger>
          <TabsTrigger value="csv-cro" className="gap-2">
            <Upload className="h-4 w-4" />
            Customer CRO
          </TabsTrigger>
          <TabsTrigger value="traditional" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Traditional
          </TabsTrigger>
        </TabsList>

        {/* Shopify Opt-In Analysis Tab */}
        <TabsContent value="shopify" className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => document.getElementById('shopify-csv-upload')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Add CSV
            </Button>
            <input
              id="shopify-csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                const formData = new FormData();
                formData.append('file', file);
                
                try {
                  toast.loading('Importing CSV data...', { id: 'csv-import' });
                  const { data, error } = await supabase.functions.invoke('import-orders-csv', {
                    body: formData,
                  });
                  
                  if (error) throw error;
                  
                  if (data?.success) {
                    toast.success(`Imported ${data.imported || 0} orders from CSV`, { id: 'csv-import' });
                    // Refresh data after import
                    fetchOrderAnalytics();
                  } else {
                    throw new Error(data?.error || 'Failed to import CSV');
                  }
                } catch (err: any) {
                  console.error('CSV import error:', err);
                  toast.error(err.message || 'Failed to import CSV', { id: 'csv-import' });
                }
                
                // Reset file input
                e.target.value = '';
              }}
            />
            <Button 
              onClick={fetchOrderAnalytics} 
              disabled={isFetchingData}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetchingData ? 'animate-spin' : ''}`} />
              {isFetchingData ? 'Analyzing...' : 'Fetch Shopify Data'}
            </Button>
            <Button 
              onClick={runCROAnalysis} 
              disabled={!orderAnalytics || isAnalyzing}
            >
              <Brain className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-pulse' : ''}`} />
              {isAnalyzing ? 'Analyzing...' : 'Run AI CRO Analysis'}
            </Button>
            {lastAnalyzed && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Last analyzed: {new Date(lastAnalyzed).toLocaleDateString()} {new Date(lastAnalyzed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

          {/* Behavioral Signals (Non-PII Data) */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Behavioral Signals
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-normal">
                Non-PII
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Device Type */}
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Device Type</h3>
                    <p className="text-xs text-muted-foreground">Mobile vs Desktop</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Mobile</span>
                    </div>
                    <span className="text-sm text-muted-foreground">Not captured</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Desktop</span>
                    </div>
                    <span className="text-sm text-muted-foreground">Not captured</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Schema ready for future tracking
                </p>
              </div>

              {/* Basket Composition */}
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Basket Composition</h3>
                    <p className="text-xs text-muted-foreground">High-level categories</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="text-sm">Avg Items/Order</span>
                    <span className="text-sm text-muted-foreground">Not captured</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="text-sm">Multi-item Orders</span>
                    <span className="text-sm text-muted-foreground">Not captured</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Requires line item data import
                </p>
              </div>

              {/* Retailer Type */}
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Retailer Comparison</h3>
                    <p className="text-xs text-muted-foreground">Performance by store type</p>
                  </div>
                </div>
                {filteredStoreAnalytics.length > 0 ? (
                  <div className="space-y-2">
                    {filteredStoreAnalytics.slice(0, 3).map((store, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm truncate max-w-[120px]">
                          {store.storeId.replace('.myshopify.com', '')}
                        </span>
                        <span className={`text-sm font-semibold ${parseFloat(store.optInRate) > 10 ? 'text-primary' : ''}`}>
                          {store.optInRate}%
                        </span>
                      </div>
                    ))}
                    {filteredStoreAnalytics.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{filteredStoreAnalytics.length - 3} more stores
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Run analysis to see store comparison
                  </div>
                )}
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
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Top Cities */}
              {orderAnalytics.geographic.bestCitiesByOptIn && orderAnalytics.geographic.bestCitiesByOptIn.length > 0 && (
                <div className="metric-card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Best Cities by Opt-In Rate
                  </h2>
                  <div className="space-y-2">
                    {orderAnalytics.geographic.bestCitiesByOptIn.slice(0, 10).map((city, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm font-medium">{city.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">{city.total} orders</span>
                          <span className={`text-sm font-bold ${parseFloat(city.optInRate) > 15 ? 'text-primary' : ''}`}>
                            {city.optInRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Provinces/Regions */}
              {orderAnalytics.geographic.topProvinces && orderAnalytics.geographic.topProvinces.length > 0 && (
                <div className="metric-card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Opt-In by Region
                  </h2>
                  <div className="space-y-2">
                    {orderAnalytics.geographic.topProvinces.slice(0, 10).map((province, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm font-medium">{province.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">{province.total.toLocaleString()} orders</span>
                          <span className={`text-sm font-bold ${parseFloat(province.optInRate) > 10 ? 'text-primary' : ''}`}>
                            {province.optInRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

              {croAnalysis.actionableRecommendations && croAnalysis.actionableRecommendations.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    AI Recommendations
                  </h2>
                  <div className="space-y-3">
                    {croAnalysis.actionableRecommendations
                      .sort((a, b) => a.priority - b.priority)
                      .map((rec, i) => (
                        <div key={i} className="metric-card border-l-4 border-l-primary">
                          <div className="flex items-start gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                              {rec.priority}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold mb-1">{rec.action}</h3>
                              <p className="text-sm text-muted-foreground mb-2">{rec.implementation}</p>
                              <p className="text-sm text-primary font-medium">Expected Impact: {rec.expectedImpact}</p>
                            </div>
                          </div>
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
        </TabsContent>

        {/* Customer CRO Analysis Tab */}
        <TabsContent value="csv-cro" className="space-y-6">
          <CSVUploadAnalysis 
            onAnalysisComplete={(analysis) => {
              setCsvCroAnalysis(analysis);
              saveToStorage('kvatt_csv_cro_analysis', analysis);
            }}
            onDataImported={() => {
              toast.success('Data imported! You can now run AI analysis.');
            }}
          />
          
          {/* Show CSV CRO Analysis results if available */}
          {csvCroAnalysis && (
            <div className="space-y-6">
              {csvCroAnalysis.keyFindings && csvCroAnalysis.keyFindings.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    AI Key Findings from Uploaded Data
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {csvCroAnalysis.keyFindings.map((finding, i) => (
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

              {csvCroAnalysis.actionableRecommendations && csvCroAnalysis.actionableRecommendations.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    AI Recommendations
                  </h2>
                  <div className="space-y-3">
                    {csvCroAnalysis.actionableRecommendations
                      .sort((a, b) => a.priority - b.priority)
                      .map((rec, i) => (
                        <div key={i} className="metric-card border-l-4 border-l-primary">
                          <div className="flex items-start gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                              {rec.priority}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold mb-1">{rec.action}</h3>
                              <p className="text-sm text-muted-foreground mb-2">{rec.implementation}</p>
                              <p className="text-sm text-primary font-medium">Expected Impact: {rec.expectedImpact}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {csvCroAnalysis.rawAnalysis && !csvCroAnalysis.keyFindings && (
                <div className="metric-card">
                  <h2 className="text-lg font-semibold mb-4">AI Analysis</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">{csvCroAnalysis.rawAnalysis}</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Traditional Insights Tab */}
        <TabsContent value="traditional" className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by merchant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Merchants</SelectItem>
              {merchants.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading insights...</div>
          ) : insights.length === 0 ? (
            <div className="text-center py-12">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Insights Yet</h3>
              <p className="text-muted-foreground mb-4">
                Use the CRO Analysis tab for AI-powered insights from your order data.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {insights.map((insight) => (
                <div key={insight.id} className="metric-card group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {insightTypeIcons[insight.insight_type] || insightTypeIcons.default}
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${trendColors[insight.trend]}`}>
                        {trendIcons[insight.trend]}
                        {insight.trend === 'up' ? 'Improving' : insight.trend === 'down' ? 'Declining' : 'Stable'}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-2">{insight.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{insight.description}</p>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary">
                      {typeof insight.value === 'number' && insight.value % 1 !== 0 
                        ? insight.value.toFixed(1) 
                        : insight.value?.toLocaleString()}
                    </span>
                    {insight.insight_type === 'return_rate' && <span className="text-muted-foreground">%</span>}
                    {insight.insight_type === 'opt_in_rate' && <span className="text-muted-foreground">%</span>}
                    {insight.insight_type === 'package_usage' && <span className="text-muted-foreground">avg uses</span>}
                    {insight.insight_type === 'customer_engagement' && <span className="text-muted-foreground">scans</span>}
                  </div>

                  {insight.merchant_name && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <span className="text-xs text-muted-foreground">{insight.merchant_name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Read-only Metrics Chatbot */}
      <InsightsChatbot />
    </div>
  );
};

export default Insights;
