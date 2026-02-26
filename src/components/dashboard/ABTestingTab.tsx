import { useEffect, useState, useRef } from 'react';
import { FlaskConical, RefreshCw, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useABTestingAnalytics, ABTestingData } from '@/hooks/useABTestingAnalytics';
import { useUserDefaults } from '@/hooks/useUserDefaults';
import { DateRange } from '@/types/analytics';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getDisplayStoreName } from '@/hooks/useAnalytics';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, getISOWeek } from 'date-fns';

const DESIGN_LABELS = [
  'General',
  'Universal Work',
  'Toast',
  'Universal Work Collapsible',
  'Toast Collapsible',
  'UW 18-12-2025',
];

function StoreRow({ item }: { item: ABTestingData }) {
  const [expanded, setExpanded] = useState(false);
  const hasVariants = item.variants.length > 0;

  return (
    <>
      <TableRow
        className={`border-border hover:bg-secondary/50 ${hasVariants ? 'cursor-pointer' : ''}`}
        onClick={() => hasVariants && setExpanded(!expanded)}
      >
        <TableCell className="font-medium text-foreground">
          <div className="flex items-center gap-2">
            {hasVariants ? (
              expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <span className="w-4" />
            )}
            {getDisplayStoreName(item.store)}
          </div>
        </TableCell>
        <TableCell className="text-right font-mono text-foreground">
          {(item.total_checkouts || 0).toLocaleString()}
        </TableCell>
        <TableCell className="text-right font-mono text-primary">
          {(item.opt_ins || 0).toLocaleString()}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {(item.opt_outs || 0).toLocaleString()}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {hasVariants ? `${item.variants.length} design${item.variants.length > 1 ? 's' : ''}` : '—'}
        </TableCell>
      </TableRow>
      {expanded && (
        <>
          {/* Show all design labels, with data if available */}
          {DESIGN_LABELS.map((designName) => {
            const variant = item.variants.find(v => v.name === designName);
            return (
              <TableRow key={designName} className="border-border bg-secondary/30">
                <TableCell className="pl-12 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                    {designName}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-foreground">
                  {variant ? variant.total.toLocaleString() : '0'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-primary">
                  {variant ? variant.opt_ins.toLocaleString() : '0'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {variant ? variant.opt_outs.toLocaleString() : '0'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {variant && variant.total > 0 ? (
                    <span className={variant.opt_in_rate >= 50 ? 'text-primary font-medium' : 'text-muted-foreground'}>
                      {variant.opt_in_rate.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </>
      )}
    </>
  );
}

export function ABTestingTab() {
  const { data, stores, isLoading, error, fetchStores, fetchAnalytics } = useABTestingAnalytics();
  const { getDefaultDateRange, isInitialized: defaultsInitialized } = useUserDefaults();

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (defaultsInitialized && !dateRange) {
      setDateRange(getDefaultDateRange());
    }
  }, [defaultsInitialized, getDefaultDateRange, dateRange]);

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
    toast.success('Data refreshed');
  };

  const handleDateRangeChange = async (range: DateRange) => {
    setDateRange(range);
    if (range.from && range.to) {
      await fetchAnalytics(range, 'all');
      setLastUpdated(new Date());
    }
  };

  const exportToCSV = () => {
    const today = new Date();
    const dateStr = dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}`
      : format(today, 'yyyy-MM-dd');

    const headers = ['Store', 'Design', 'Total', 'Opt-ins', 'Opt-outs', 'Opt-in Rate'];
    const rows: string[][] = [];
    data.forEach((item) => {
      rows.push([getDisplayStoreName(item.store), '', String(item.total_checkouts), String(item.opt_ins), String(item.opt_outs), '']);
      item.variants.forEach(v => {
        rows.push(['', v.name, String(v.total), String(v.opt_ins), String(v.opt_outs), `${v.opt_in_rate.toFixed(1)}%`]);
      });
    });
    const csv = [headers.join(','), ...rows.map((row) => row.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kvatt-ab-testing-${dateStr}.csv`;
    a.click();
  };

  const storesWithAB = data.filter(item => item.variants.length > 0);
  const storesWithoutAB = data.filter(item => item.variants.length === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="icon-glow">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">A/B Testing</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Click a store row to expand and see per-design breakdown
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {dateRange && (
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              disabled={isLoading}
            />
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {isLoading && data.length === 0 ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Stores WITH A/B Tests */}
          {storesWithAB.length > 0 && (
            <div className="data-table">
              <div className="border-b border-border p-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                  Stores with A/B Tests ({storesWithAB.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead className="text-muted-foreground">Store / Design</TableHead>
                      <TableHead className="text-right text-muted-foreground">Total</TableHead>
                      <TableHead className="text-right text-muted-foreground">Opt-ins</TableHead>
                      <TableHead className="text-right text-muted-foreground">Opt-outs</TableHead>
                      <TableHead className="text-right text-muted-foreground">Designs / Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storesWithAB.map((item, index) => (
                      <StoreRow key={index} item={item} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Stores WITHOUT A/B Tests */}
          {storesWithoutAB.length > 0 && (
            <div className="data-table">
              <div className="border-b border-border p-4">
                <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40" />
                  Stores without A/B Tests ({storesWithoutAB.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead className="text-muted-foreground">Store</TableHead>
                      <TableHead className="text-right text-muted-foreground">Total Checkouts</TableHead>
                      <TableHead className="text-right text-muted-foreground">Opt-ins</TableHead>
                      <TableHead className="text-right text-muted-foreground">Opt-outs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storesWithoutAB.map((item, index) => (
                      <TableRow key={index} className="border-border hover:bg-secondary/50 opacity-70">
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="w-4" />
                            {getDisplayStoreName(item.store)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-foreground">
                          {(item.total_checkouts || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          {(item.opt_ins || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {(item.opt_outs || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {data.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No data available for the selected date range
            </div>
          )}
        </div>
      )}
    </div>
  );
}
