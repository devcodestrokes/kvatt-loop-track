import { useState, useEffect, useRef } from 'react';
import { 
  Lightbulb, TrendingUp, TrendingDown, Minus, Package, Users, Recycle, Target, 
  RefreshCw, Brain, MapPin, Clock, ShoppingCart, Store, Zap, AlertCircle, CheckCircle,
  Upload, FileSpreadsheet, Database
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

interface CustomerAnalytics {
  summary: {
    totalCustomers: number;
    optInCustomers?: number;
    totalOptIns?: number;
    optOutCustomers?: number;
    totalOptOuts?: number;
    optInRate: string;
    totalOrders: number;
    totalLineItems?: number;
    avgOptInOrderValue?: string;
    avgOptOutOrderValue?: string;
  };
  geographic?: {
    topCountries?: Array<{ name: string; total: number; optIn: number; optInRate: string }>;
    topCities?: Array<{ name: string; total: number; optIn: number; optInRate: string }>;
    optInByCountry?: [string, number][];
    optInByCity?: [string, number][];
    optOutByCountry?: [string, number][];
  };
  stores?: Array<{
    name: string;
    total: number;
    optIn: number;
    optInRate: string;
  }>;
  products?: {
    optInTopProducts?: Array<{ name: string; quantity: number; revenue: number }>;
    optOutTopProducts?: Array<{ name: string; quantity: number; revenue: number }>;
    topOptInProducts?: Array<{ product: string; count: number; revenue: number }>;
    topOptOutProducts?: Array<{ product: string; count: number; revenue: number }>;
  };
  orderValue?: {
    avgOrderValueOptIn: string;
    avgOrderValueOptOut: string;
    difference: string;
    percentDifference: string;
  };
  temporal?: {
    optInsByHour?: Record<number, number> | Array<{ hour: number; count: number }>;
    optInsByDay?: Record<number, number>;
    optInsByDayOfWeek?: Array<{ day: string; count: number }>;
    peakHour?: string | null;
    peakDay?: string | null;
  };
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

const Insights = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cro');
  
  // CRO Analysis state
  const [customerData, setCustomerData] = useState<CustomerAnalytics | null>(null);
  const [croAnalysis, setCroAnalysis] = useState<CROAnalysis | null>(null);
  const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [orderCount, setOrderCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const fetchOrderCount = async () => {
    const { count } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true });
    setOrderCount(count || 0);
  };

  const fetchCustomerData = async () => {
    setIsFetchingCustomers(true);
    try {
      // Query from imported_orders table
      const { data: orders, error } = await supabase
        .from('imported_orders')
        .select('*');
      
      if (error) throw error;
      
      if (!orders || orders.length === 0) {
        toast.error('No orders found. Please import CSV data first.');
        return;
      }

      // Calculate analytics from the imported orders
      const totalOrders = orders.length;
      const optInOrders = orders.filter(o => o.opt_in);
      const optOutOrders = orders.filter(o => !o.opt_in);
      const optInRate = ((optInOrders.length / totalOrders) * 100).toFixed(2);

      // Geographic analysis
      const cityStats = new Map<string, { total: number; optIn: number }>();
      const countryStats = new Map<string, { total: number; optIn: number }>();
      const storeStats = new Map<string, { total: number; optIn: number }>();

      orders.forEach(order => {
        // City stats
        if (order.city) {
          const cityKey = order.city;
          const existing = cityStats.get(cityKey) || { total: 0, optIn: 0 };
          cityStats.set(cityKey, {
            total: existing.total + 1,
            optIn: existing.optIn + (order.opt_in ? 1 : 0)
          });
        }

        // Country stats
        if (order.country) {
          const countryKey = order.country;
          const existing = countryStats.get(countryKey) || { total: 0, optIn: 0 };
          countryStats.set(countryKey, {
            total: existing.total + 1,
            optIn: existing.optIn + (order.opt_in ? 1 : 0)
          });
        }

        // Store stats
        if (order.store_id) {
          const storeKey = order.store_id;
          const existing = storeStats.get(storeKey) || { total: 0, optIn: 0 };
          storeStats.set(storeKey, {
            total: existing.total + 1,
            optIn: existing.optIn + (order.opt_in ? 1 : 0)
          });
        }
      });

      // Calculate average order values
      const avgOptInOrderValue = optInOrders.length > 0 
        ? (optInOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0) / optInOrders.length).toFixed(2)
        : '0';
      const avgOptOutOrderValue = optOutOrders.length > 0 
        ? (optOutOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0) / optOutOrders.length).toFixed(2)
        : '0';

      const analytics: CustomerAnalytics = {
        summary: {
          totalCustomers: totalOrders,
          totalOptIns: optInOrders.length,
          totalOptOuts: optOutOrders.length,
          optInRate,
          totalOrders,
          avgOptInOrderValue,
          avgOptOutOrderValue,
        },
        geographic: {
          topCities: Array.from(cityStats.entries())
            .map(([name, stats]) => ({
              name,
              total: stats.total,
              optIn: stats.optIn,
              optInRate: ((stats.optIn / stats.total) * 100).toFixed(1)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10),
          topCountries: Array.from(countryStats.entries())
            .map(([name, stats]) => ({
              name,
              total: stats.total,
              optIn: stats.optIn,
              optInRate: ((stats.optIn / stats.total) * 100).toFixed(1)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10),
        },
        stores: Array.from(storeStats.entries())
          .map(([name, stats]) => ({
            name,
            total: stats.total,
            optIn: stats.optIn,
            optInRate: ((stats.optIn / stats.total) * 100).toFixed(1)
          }))
          .sort((a, b) => b.total - a.total),
        orderValue: {
          avgOrderValueOptIn: avgOptInOrderValue,
          avgOrderValueOptOut: avgOptOutOrderValue,
          difference: (parseFloat(avgOptInOrderValue) - parseFloat(avgOptOutOrderValue)).toFixed(2),
          percentDifference: avgOptOutOrderValue !== '0' 
            ? (((parseFloat(avgOptInOrderValue) - parseFloat(avgOptOutOrderValue)) / parseFloat(avgOptOutOrderValue)) * 100).toFixed(1)
            : '0'
        }
      };

      setCustomerData(analytics);
      toast.success(`Analyzed ${totalOrders.toLocaleString()} orders`);
    } catch (error: any) {
      console.error('Error fetching customer data:', error);
      toast.error(error.message || 'Failed to fetch customer data');
    } finally {
      setIsFetchingCustomers(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: files.length });

    let totalImported = 0;
    let totalErrors = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setImportProgress({ current: i + 1, total: files.length });
        
        toast.info(`Processing file ${i + 1}/${files.length}: ${file.name}`);

        const text = await file.text();
        
        const { data, error } = await supabase.functions.invoke('import-orders-csv', {
          body: { csvData: text, batchNumber: i + 1 }
        });

        if (error) {
          console.error(`Error importing ${file.name}:`, error);
          totalErrors++;
        } else if (data) {
          totalImported += data.inserted || 0;
        }
      }

      toast.success(`Imported ${totalImported.toLocaleString()} orders from ${files.length} files`);
      fetchOrderCount();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import CSV files');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const runCROAnalysis = async () => {
    if (!customerData) {
      toast.error('Please fetch customer data first');
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-cro-patterns', {
        body: { analyticsData: customerData }
      });
      
      if (error) throw error;
      
      if (data?.data?.analysis) {
        setCroAnalysis(data.data.analysis);
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
    fetchOrderCount();
  }, [selectedMerchant]);

  const formatStoreName = (store: string) => {
    return store.replace('.myshopify.com', '').replace(/-/g, ' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered CRO analytics and opt-in pattern analysis
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="cro" className="gap-2">
            <Brain className="h-4 w-4" />
            CRO Analysis
          </TabsTrigger>
          <TabsTrigger value="traditional" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Traditional
          </TabsTrigger>
        </TabsList>

        {/* CRO Analysis Tab */}
        <TabsContent value="cro" className="space-y-6">
          {/* CSV Import Section */}
          <div className="metric-card">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Order Data</h3>
                  <p className="text-sm text-muted-foreground">
                    {orderCount > 0 
                      ? `${orderCount.toLocaleString()} orders in database`
                      : 'No orders imported yet'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <Button 
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  <Upload className={`h-4 w-4 mr-2 ${isImporting ? 'animate-pulse' : ''}`} />
                  {isImporting 
                    ? `Importing ${importProgress.current}/${importProgress.total}...`
                    : 'Import CSV Files'}
                </Button>
              </div>
            </div>
            {isImporting && (
              <div className="mt-4">
                <Progress value={(importProgress.current / importProgress.total) * 100} className="h-2" />
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={fetchCustomerData} 
              disabled={isFetchingCustomers || orderCount === 0}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetchingCustomers ? 'animate-spin' : ''}`} />
              {isFetchingCustomers ? 'Analyzing...' : 'Analyze Order Data'}
            </Button>
            <Button 
              onClick={runCROAnalysis} 
              disabled={!customerData || isAnalyzing}
            >
              <Brain className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-pulse' : ''}`} />
              {isAnalyzing ? 'Analyzing...' : 'Run AI CRO Analysis'}
            </Button>
          </div>

          {/* Summary Cards */}
          {customerData && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Customers</span>
                </div>
                <p className="text-3xl font-bold">{customerData.summary.totalCustomers.toLocaleString()}</p>
              </div>
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Opt-In Rate</span>
                </div>
                <p className="text-3xl font-bold text-primary">{customerData.summary.optInRate}%</p>
                <div className="mt-2">
                  <Progress value={parseFloat(customerData.summary.optInRate)} className="h-2" />
                </div>
              </div>
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Avg Opt-In Order</span>
                </div>
                <p className="text-3xl font-bold">${customerData.orderValue?.avgOrderValueOptIn || customerData.summary.avgOptInOrderValue || '0'}</p>
              </div>
              <div className="metric-card">
                <div className="flex items-center gap-3 mb-2">
                  <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg Opt-Out Order</span>
                </div>
                <p className="text-3xl font-bold">${customerData.orderValue?.avgOrderValueOptOut || customerData.summary.avgOptOutOrderValue || '0'}</p>
              </div>
            </div>
          )}

          {/* CRO Analysis Results */}
          {croAnalysis && (
            <div className="space-y-6">
              {/* Key Findings */}
              {croAnalysis.keyFindings && croAnalysis.keyFindings.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Key Findings
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

              {/* Demographic Patterns */}
              {croAnalysis.demographicPatterns && (
                <div className="metric-card">
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <MapPin className="h-5 w-5 text-primary" />
                    Demographic Patterns
                  </h2>
                  <p className="text-muted-foreground mb-4">{croAnalysis.demographicPatterns.summary}</p>
                  {croAnalysis.demographicPatterns.topLocations && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {croAnalysis.demographicPatterns.topLocations.map((loc, i) => (
                        <span key={i} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                          {loc}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Recommendation:</p>
                    <p className="text-sm text-muted-foreground">{croAnalysis.demographicPatterns.recommendation}</p>
                  </div>
                </div>
              )}

              {/* Behavioral Patterns */}
              {croAnalysis.behavioralPatterns && (
                <div className="metric-card">
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-primary" />
                    Behavioral Patterns
                  </h2>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Order Value</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{croAnalysis.behavioralPatterns.orderValueInsight}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Products</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{croAnalysis.behavioralPatterns.productPreferences}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Timing</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{croAnalysis.behavioralPatterns.timingInsights}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Store Analysis */}
              {croAnalysis.storeAnalysis && (
                <div className="metric-card">
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Store className="h-5 w-5 text-primary" />
                    Store Performance Analysis
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 mb-4">
                    <div>
                      <p className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" /> Top Performers
                      </p>
                      <ul className="space-y-1">
                        {croAnalysis.storeAnalysis.topPerformers?.map((store, i) => (
                          <li key={i} className="text-sm text-muted-foreground">• {store}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> Needs Improvement
                      </p>
                      <ul className="space-y-1">
                        {croAnalysis.storeAnalysis.underperformers?.map((store, i) => (
                          <li key={i} className="text-sm text-muted-foreground">• {store}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Recommendation:</p>
                    <p className="text-sm text-muted-foreground">{croAnalysis.storeAnalysis.recommendation}</p>
                  </div>
                </div>
              )}

              {/* Actionable Recommendations */}
              {croAnalysis.actionableRecommendations && croAnalysis.actionableRecommendations.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Actionable Recommendations
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

              {/* Predicted Impact */}
              {croAnalysis.predictedOptInIncrease && (
                <div className="metric-card bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Predicted Opt-In Increase</p>
                      <p className="text-2xl font-bold text-primary">{croAnalysis.predictedOptInIncrease}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw Analysis Fallback */}
              {croAnalysis.rawAnalysis && !croAnalysis.keyFindings && (
                <div className="metric-card">
                  <h2 className="text-lg font-semibold mb-4">AI Analysis</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">{croAnalysis.rawAnalysis}</p>
                </div>
              )}
            </div>
          )}

          {/* Store Performance Table from Raw Data */}
          {customerData && customerData.stores && customerData.stores.length > 0 && (
            <div className="metric-card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Store Opt-In Rates
              </h2>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th className="text-right">Opt-Ins</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerData.stores.slice(0, 10).map((store, i) => (
                      <tr key={i}>
                        <td className="font-medium">{formatStoreName(store.name)}</td>
                        <td className="text-right text-primary">{store.optIn}</td>
                        <td className="text-right text-muted-foreground">{store.total}</td>
                        <td className="text-right">
                          <span className={`font-semibold ${parseFloat(store.optInRate) > 10 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {store.optInRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Product Preferences */}
          {customerData?.products && ((customerData.products.optInTopProducts?.length || 0) > 0 || (customerData.products.topOptInProducts?.length || 0) > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="metric-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Top Products (Opt-In Customers)
                </h2>
                <div className="space-y-2">
                  {(customerData.products.optInTopProducts || customerData.products.topOptInProducts || []).slice(0, 8).map((product: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span className="text-sm truncate flex-1">{product.name || product.product}</span>
                      <span className="text-sm font-medium text-primary ml-2">{product.quantity || product.count} sold</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="metric-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  Top Products (Opt-Out Customers)
                </h2>
                <div className="space-y-2">
                  {(customerData.products.optOutTopProducts || customerData.products.topOptOutProducts || []).slice(0, 8).map((product: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span className="text-sm truncate flex-1">{product.name || product.product}</span>
                      <span className="text-sm font-medium text-muted-foreground ml-2">{product.quantity || product.count} sold</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!customerData && !isFetchingCustomers && (
            <div className="text-center py-12">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {orderCount === 0 ? 'No Order Data Yet' : 'Ready to Analyze'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {orderCount === 0 
                  ? 'Import your order CSV files to get started with analytics.'
                  : `Click "Analyze Order Data" to process ${orderCount.toLocaleString()} orders.`}
              </p>
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
                Use the CRO Analysis tab for AI-powered insights from your customer data.
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
    </div>
  );
};

export default Insights;
