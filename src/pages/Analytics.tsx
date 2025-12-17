import { useEffect, useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ShoppingCart, CheckCircle, XCircle, TrendingUp, Sparkles, RefreshCw } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useStoreFilter } from '@/hooks/useStoreFilter';
import { useUserDefaults } from '@/hooks/useUserDefaults';
import { DateRange } from '@/types/analytics';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MultiStoreSelector } from '@/components/dashboard/MultiStoreSelector';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart';
import { DataTable } from '@/components/dashboard/DataTable';
import { WeeklyBreakdown } from '@/components/dashboard/WeeklyBreakdown';
import { LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const ANALYTICS_API_URL = "https://shopify.kvatt.com/api/get-alaytics";
const AUTH_TOKEN = "Bearer %^75464tnfsdhndsfbgr54";

const Analytics = () => {
  const {
    data,
    stores,
    isLoading,
    error,
    fetchStores,
    fetchAnalytics,
  } = useAnalytics();

  const {
    selectedStores,
    toggleStore,
    selectAll,
    unselectAll,
    isInitialized,
  } = useStoreFilter(stores);

  const { getDefaultDateRange, isInitialized: defaultsInitialized } = useUserDefaults();

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();

  // Initialize date range from user defaults
  useEffect(() => {
    if (defaultsInitialized && !dateRange) {
      setDateRange(getDefaultDateRange());
    }
  }, [defaultsInitialized, getDefaultDateRange, dateRange]);

  // Filter data based on selected stores
  const filteredData = useMemo(() => {
    if (selectedStores.length === 0 || selectedStores.length === stores.length) {
      return data;
    }
    return data.filter(item => selectedStores.includes(item.store));
  }, [data, selectedStores, stores.length]);

  // Calculate totals from filtered data
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => ({
        totalCheckouts: acc.totalCheckouts + (item.total_checkouts || 0),
        totalOptIns: acc.totalOptIns + (item.opt_ins || 0),
        totalOptOuts: acc.totalOptOuts + (item.opt_outs || 0),
      }),
      { totalCheckouts: 0, totalOptIns: 0, totalOptOuts: 0 }
    );
  }, [filteredData]);

  // Calculate opt-in rate with 2 decimals
  const optInRate = useMemo(() => {
    if (totals.totalCheckouts === 0) return '0.00';
    return ((totals.totalOptIns / totals.totalCheckouts) * 100).toFixed(2);
  }, [totals]);

  // Function to fetch daily data for WeeklyBreakdown
  const fetchDailyData = useCallback(async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      const url = `${ANALYTICS_API_URL}?store=all&start_date=${dateStr}&end_date=${dateStr}`;
      const response = await fetch(url, {
        headers: {
          "Authorization": AUTH_TOKEN,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });
      const result = await response.json();
      
      if (result.status === 200 && result.data?.length) {
        // Filter by selected stores if needed
        const filtered = selectedStores.length > 0 && selectedStores.length !== stores.length
          ? result.data.filter((item: any) => selectedStores.includes(item.store))
          : result.data;
        
        return filtered.reduce(
          (acc: any, item: any) => ({
            checkouts: acc.checkouts + (item.total_checkouts || 0),
            optIns: acc.optIns + (item.opt_ins || 0),
            optOuts: acc.optOuts + (item.opt_outs || 0),
          }),
          { checkouts: 0, optIns: 0, optOuts: 0 }
        );
      }
      return { checkouts: 0, optIns: 0, optOuts: 0 };
    } catch {
      return { checkouts: 0, optIns: 0, optOuts: 0 };
    }
  }, [selectedStores, stores.length]);

  useEffect(() => {
    if (!dateRange) return;
    const loadInitialData = async () => {
      await fetchStores();
      await fetchAnalytics(dateRange, 'all');
      setLastUpdated(new Date());
    };
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  useEffect(() => {
    if (error) {
      toast.error('Failed to load analytics', {
        description: error,
      });
    }
  }, [error]);

  const handleRefresh = async () => {
    if (!dateRange) return;
    await fetchAnalytics(dateRange, 'all');
    setLastUpdated(new Date());
    toast.success('Data refreshed');
  };

  const handleDateRangeChange = async (range: DateRange) => {
    setDateRange(range);
    if (range.from && range.to && dateRange) {
      await fetchAnalytics(range, 'all');
      setLastUpdated(new Date());
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="icon-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="badge-premium">Live Data</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Track opt-in rates and packaging adoption across your stores
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-2 rounded-xl border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:bg-card hover:shadow-md"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <MultiStoreSelector
          stores={stores}
          selectedStores={selectedStores}
          onToggleStore={toggleStore}
          onSelectAll={selectAll}
          onUnselectAll={unselectAll}
          disabled={isLoading}
        />
        {dateRange && (
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            disabled={isLoading}
          />
        )}
      </div>

      {isLoading && data.length === 0 ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Checkouts"
              value={totals.totalCheckouts.toLocaleString()}
              icon={<ShoppingCart className="h-5 w-5" />}
              color="blue"
              delay={0}
            />
            <MetricCard
              title="Opt-ins"
              value={totals.totalOptIns.toLocaleString()}
              icon={<CheckCircle className="h-5 w-5" />}
              color="coral"
              delay={100}
            />
            <MetricCard
              title="Opt-outs"
              value={totals.totalOptOuts.toLocaleString()}
              icon={<XCircle className="h-5 w-5" />}
              color="muted"
              delay={200}
            />
            <MetricCard
              title="Opt-in Rate"
              value={`${optInRate}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              color="brown"
              delay={300}
            />
          </div>

          {/* Charts */}
          {filteredData.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AnalyticsChart data={filteredData} type="bar" />
              </div>
              <div>
                <AnalyticsChart data={filteredData} type="pie" />
              </div>
            </div>
          )}

          {/* Weekly Breakdown */}
          <WeeklyBreakdown 
            fetchDailyData={fetchDailyData}
            selectedStores={selectedStores}
            isLoading={isLoading}
          />

          {/* Data Table */}
          <DataTable data={filteredData} dateRange={dateRange || undefined} />
        </>
      )}
    </div>
  );
};

export default Analytics;
