import { useEffect, useState, useCallback } from 'react';
import { subDays } from 'date-fns';
import { ShoppingCart, CheckCircle, XCircle, TrendingUp, Sparkles } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { DateRange } from '@/types/analytics';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StoreSelector } from '@/components/dashboard/StoreSelector';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart';
import { DataTable } from '@/components/dashboard/DataTable';
import { LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const Analytics = () => {
  const {
    data,
    stores,
    isLoading,
    error,
    fetchStores,
    fetchAnalytics,
    getTotals,
    getOptInRate,
  } = useAnalytics();

  const [selectedStore, setSelectedStore] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [lastUpdated, setLastUpdated] = useState<Date>();

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchStores();
      await fetchAnalytics(dateRange, selectedStore);
      setLastUpdated(new Date());
    };
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) {
      toast.error('Failed to load analytics', {
        description: error,
      });
    }
  }, [error]);

  const handleRefresh = async () => {
    await fetchAnalytics(dateRange, selectedStore);
    setLastUpdated(new Date());
    toast.success('Data refreshed');
  };

  const handleStoreChange = async (storeId: string) => {
    setSelectedStore(storeId);
    await fetchAnalytics(dateRange, storeId);
    setLastUpdated(new Date());
  };

  const handleDateRangeChange = async (range: DateRange) => {
    setDateRange(range);
    if (range.from && range.to) {
      await fetchAnalytics(range, selectedStore);
      setLastUpdated(new Date());
    }
  };

  const totals = getTotals();
  const optInRate = getOptInRate();

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
        <StoreSelector
          stores={stores}
          selectedStore={selectedStore}
          onStoreChange={handleStoreChange}
          disabled={isLoading}
        />
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          disabled={isLoading}
        />
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
          {data.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AnalyticsChart data={data} type="bar" />
              </div>
              <div>
                <AnalyticsChart data={data} type="pie" />
              </div>
            </div>
          )}

          {/* Data Table */}
          <DataTable data={data} />
        </>
      )}
    </div>
  );
};

export default Analytics;
