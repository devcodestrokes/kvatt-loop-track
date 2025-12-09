import { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Minus, Package, Users, Recycle, Target, RefreshCw } from 'lucide-react';
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

const Insights = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    fetchData();
  }, [selectedMerchant]);

  const generateMockInsights = async () => {
    const mockInsights = [
      {
        insight_type: 'return_rate',
        title: 'Return Rate Improving',
        description: 'Package return rates have increased by 12% this month compared to last month.',
        value: 72,
        trend: 'up',
        metadata: { previous_value: 60, change_percent: 12 },
      },
      {
        insight_type: 'opt_in_rate',
        title: 'High Opt-in Adoption',
        description: 'Customer opt-in rate for reusable packaging is performing above industry average.',
        value: 15,
        trend: 'stable',
        metadata: { industry_average: 12 },
      },
      {
        insight_type: 'package_usage',
        title: 'Package Reuse Milestone',
        description: 'Average package has been reused 4.2 times, exceeding the 3x sustainability target.',
        value: 4.2,
        trend: 'up',
        metadata: { target: 3, achievement: 140 },
      },
      {
        insight_type: 'customer_engagement',
        title: 'Customer Scan Activity',
        description: 'QR code scans increased by 25% indicating higher customer engagement with returns.',
        value: 1250,
        trend: 'up',
        metadata: { previous_scans: 1000, growth_percent: 25 },
      },
    ];

    try {
      const { error } = await supabase.from('insights').insert(
        mockInsights.map(i => ({
          ...i,
          merchant_id: selectedMerchant === 'all' ? null : selectedMerchant,
        }))
      );

      if (error) throw error;
      toast.success('Insights generated');
      fetchData();
    } catch (error) {
      console.error('Error generating insights:', error);
      toast.error('Failed to generate insights');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered analytics and recommendations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={generateMockInsights}>
            <Lightbulb className="h-4 w-4 mr-2" />
            Generate Insights
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-bar">
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
      </div>

      {/* Insights Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading insights...</div>
      ) : insights.length === 0 ? (
        <div className="text-center py-12">
          <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Insights Yet</h3>
          <p className="text-muted-foreground mb-4">
            Click "Generate Insights" to analyze your data and get recommendations.
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
    </div>
  );
};

export default Insights;
