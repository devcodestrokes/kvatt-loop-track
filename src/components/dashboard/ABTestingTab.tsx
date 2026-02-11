import { useEffect, useState, useMemo, useRef } from 'react';
import { ShoppingCart, CheckCircle, XCircle, TrendingUp, FlaskConical, RefreshCw } from 'lucide-react';
import { useABTestingAnalytics, ABTestingData } from '@/hooks/useABTestingAnalytics';
import { useStoreFilter } from '@/hooks/useStoreFilter';
import { useUserDefaults } from '@/hooks/useUserDefaults';
import { DateRange } from '@/types/analytics';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MultiStoreSelector } from '@/components/dashboard/MultiStoreSelector';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getDisplayStoreName } from '@/hooks/useAnalytics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpDown, Download } from 'lucide-react';
import { format, getISOWeek } from 'date-fns';

const COLORS = {
  abCheckout: '#6366f1',
  abOptIn: '#22c55e',
  abOptOut: '#ef4444',
};

const PIE_COLORS = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

type SortField = 'store' | 'ab_testing_checkout' | 'ab_testing_opt_in' | 'ab_testing_opt_out';
type SortDirection = 'asc' | 'desc';

export function ABTestingTab() {
  const { data, stores, isLoading, error, fetchStores, fetchAnalytics } = useABTestingAnalytics();
  const { selectedStores, toggleStore, selectAll, unselectAll, isInitialized } = useStoreFilter(stores);
  const { getDefaultDateRange, isInitialized: defaultsInitialized } = useUserDefaults();

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const initialLoadRef = useRef(false);
  const [sortField, setSortField] = useState<SortField>('ab_testing_opt_in');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (defaultsInitialized && !dateRange) {
      setDateRange(getDefaultDateRange());
    }
  }, [defaultsInitialized, getDefaultDateRange, dateRange]);

  const filteredData = useMemo(() => {
    if (selectedStores.length === 0 || selectedStores.length === stores.length) return data;
    return data.filter(item => selectedStores.includes(item.store));
  }, [data, selectedStores, stores.length]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => ({
        abCheckouts: acc.abCheckouts + (item.ab_testing_checkout || 0),
        abOptIns: acc.abOptIns + (item.ab_testing_opt_in || 0),
        abOptOuts: acc.abOptOuts + (item.ab_testing_opt_out || 0),
      }),
      { abCheckouts: 0, abOptIns: 0, abOptOuts: 0 }
    );
  }, [filteredData]);

  const abOptInRate = useMemo(() => {
    if (totals.abCheckouts === 0) return '0.00';
    return ((totals.abOptIns / totals.abCheckouts) * 100).toFixed(2);
  }, [totals]);

  useEffect(() => {
    if (!dateRange || initialLoadRef.current) return;
    initialLoadRef.current = true;
    const loadInitialData = async () => {
      await fetchStores();
      await fetchAnalytics(dateRange, 'all');
      setLastUpdated(new Date());
    };
    loadInitialData();
  }, [dateRange, fetchStores, fetchAnalytics]);

  useEffect(() => {
    if (error) {
      toast.error('Failed to load A/B testing data', { description: error });
    }
  }, [error]);

  const handleRefresh = async () => {
    if (!dateRange) return;
    await fetchAnalytics(dateRange, 'all');
    setLastUpdated(new Date());
    toast.success('A/B Testing data refreshed');
  };

  const handleDateRangeChange = async (range: DateRange) => {
    setDateRange(range);
    if (range.from && range.to) {
      await fetchAnalytics(range, 'all');
      setLastUpdated(new Date());
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
    });
  }, [filteredData, sortField, sortDirection]);

  const chartData = useMemo(() => {
    return filteredData.map((item) => ({
      name: getDisplayStoreName(item.store),
      'AB Checkouts': item.ab_testing_checkout || 0,
      'AB Opt-ins': item.ab_testing_opt_in || 0,
      'AB Opt-outs': item.ab_testing_opt_out || 0,
    }));
  }, [filteredData]);

  const pieData = useMemo(() => {
    return filteredData
      .filter(item => (item.ab_testing_opt_in || 0) > 0)
      .map((item) => ({
        name: getDisplayStoreName(item.store),
        value: item.ab_testing_opt_in || 0,
      }));
  }, [filteredData]);

  const exportToCSV = () => {
    const today = new Date();
    const weekNum = getISOWeek(today);
    const dateStr = dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}`
      : format(today, 'yyyy-MM-dd');
    const headers = ['Store', 'Date Range', 'ISO Week', 'AB Checkouts', 'AB Opt-ins', 'AB Opt-outs', 'AB Opt-in Rate'];
    const rows = filteredData.map((item) => {
      const rate = item.ab_testing_checkout > 0
        ? ((item.ab_testing_opt_in / item.ab_testing_checkout) * 100).toFixed(2)
        : '0.00';
      return [
        getDisplayStoreName(item.store),
        dateRange?.from && dateRange?.to
          ? `${format(dateRange.from, 'yyyy-MM-dd')} to ${format(dateRange.to, 'yyyy-MM-dd')}`
          : format(today, 'yyyy-MM-dd'),
        `Week ${weekNum}`,
        item.ab_testing_checkout || 0,
        item.ab_testing_opt_in || 0,
        item.ab_testing_opt_out || 0,
        `${rate}%`,
      ];
    });
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kvatt-ab-testing-${dateStr}.csv`;
    a.click();
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="icon-glow">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <span className="badge-premium">A/B Test Data</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">A/B Testing Analytics</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Compare A/B test checkout performance across stores
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
          {/* Metric Cards */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="AB Checkouts"
              value={totals.abCheckouts.toLocaleString()}
              icon={<ShoppingCart className="h-5 w-5" />}
              color="blue"
              delay={0}
            />
            <MetricCard
              title="AB Opt-ins"
              value={totals.abOptIns.toLocaleString()}
              icon={<CheckCircle className="h-5 w-5" />}
              color="coral"
              delay={100}
            />
            <MetricCard
              title="AB Opt-outs"
              value={totals.abOptOuts.toLocaleString()}
              icon={<XCircle className="h-5 w-5" />}
              color="muted"
              delay={200}
            />
            <MetricCard
              title="AB Opt-in Rate"
              value={`${abOptInRate}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              color="brown"
              delay={300}
            />
          </div>

          {/* Charts */}
          {filteredData.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="chart-container">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">A/B Test Store Performance</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 10%, 85%)" />
                        <XAxis
                          dataKey="name"
                          stroke="hsl(20, 10%, 45%)"
                          tick={{ fill: 'hsl(20, 10%, 45%)', fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis stroke="hsl(20, 10%, 45%)" tick={{ fill: 'hsl(20, 10%, 45%)' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(40, 15%, 98%)',
                            border: '1px solid hsl(40, 10%, 85%)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="AB Checkouts" fill={COLORS.abCheckout} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="AB Opt-ins" fill={COLORS.abOptIn} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="AB Opt-outs" fill={COLORS.abOptOut} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div>
                <div className="chart-container h-full">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">AB Opt-ins by Store</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                          labelLine={false}
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(40, 15%, 98%)',
                            border: '1px solid hsl(40, 10%, 85%)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          }}
                          formatter={(value: number, name: string) => [`${value} AB opt-ins`, name]}
                        />
                        <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ paddingTop: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="data-table">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-lg font-semibold text-foreground">A/B Testing Store Details</h3>
              <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-muted-foreground">
                      <SortButton field="store">Store</SortButton>
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      <SortButton field="ab_testing_checkout">AB Checkouts</SortButton>
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      <SortButton field="ab_testing_opt_in">AB Opt-ins</SortButton>
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground">
                      <SortButton field="ab_testing_opt_out">AB Opt-outs</SortButton>
                    </TableHead>
                    <TableHead className="text-right text-muted-foreground">AB Opt-in Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No A/B testing data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedData.map((item, index) => {
                      const rate = item.ab_testing_checkout > 0
                        ? ((item.ab_testing_opt_in / item.ab_testing_checkout) * 100).toFixed(2)
                        : '0.00';
                      return (
                        <TableRow key={index} className="border-border hover:bg-secondary/50">
                          <TableCell className="font-medium text-foreground">
                            {getDisplayStoreName(item.store)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-foreground">
                            {(item.ab_testing_checkout || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-primary">
                            {(item.ab_testing_opt_in || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {(item.ab_testing_opt_out || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                parseFloat(rate) >= 50
                                  ? 'bg-primary/10 text-primary'
                                  : parseFloat(rate) >= 25
                                  ? 'bg-chart-total/10 text-chart-total'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {rate}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
