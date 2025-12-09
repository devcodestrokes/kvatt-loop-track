import { useEffect, useState, useCallback } from 'react';
import { subDays } from 'date-fns';
import { ShoppingCart, CheckCircle, XCircle, Percent } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { DateRange } from '@/types/analytics';
import { Header } from '@/components/dashboard/Header';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StoreSelector } from '@/components/dashboard/StoreSelector';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart';
import { DataTable } from '@/components/dashboard/DataTable';
import { LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { toast } from 'sonner';

const Index = () => {
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

  const loadData = useCallback(async () => {
    await fetchStores();
    await fetchAnalytics(dateRange, selectedStore);
    setLastUpdated(new Date());
  }, [fetchStores, fetchAnalytics, dateRange, selectedStore]);

  useEffect(() => {
    loadData();
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
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Header
          onRefresh={handleRefresh}
          isLoading={isLoading}
          lastUpdated={lastUpdated}
        />

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card/50 p-4">
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                color="green"
                delay={100}
              />
              <MetricCard
                title="Opt-outs"
                value={totals.totalOptOuts.toLocaleString()}
                icon={<XCircle className="h-5 w-5" />}
                color="red"
                delay={200}
              />
              <MetricCard
                title="Opt-in Rate"
                value={`${optInRate}%`}
                icon={<Percent className="h-5 w-5" />}
                color="amber"
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
    </div>
  );
};

export default Index;
