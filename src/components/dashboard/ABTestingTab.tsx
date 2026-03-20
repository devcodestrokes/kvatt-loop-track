import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { FlaskConical, RefreshCw, Download, ChevronDown, ChevronRight, ShoppingCart, ThumbsUp, ThumbsDown, Percent, Layers, Store as StoreIcon, Trophy, Medal } from 'lucide-react';
import { useABTestingAnalytics, ABTestingData } from '@/hooks/useABTestingAnalytics';
import { LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getDisplayStoreName } from '@/hooks/useAnalytics';
import { MultiStoreSelector } from '@/components/dashboard/MultiStoreSelector';
import { Store } from '@/types/analytics';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

// Design labels are now dynamically derived from API data

const DESIGN_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 55%)',
  'hsl(340, 65%, 50%)',
  'hsl(160, 55%, 45%)',
  'hsl(45, 80%, 50%)',
  'hsl(270, 55%, 55%)',
];

interface DesignAggregate {
  name: string;
  total: number;
  opt_ins: number;
  opt_outs: number;
  opt_in_rate: number;
}

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
      {expanded && item.variants.map((variant) => {
        const designName = variant.name;
        
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
  );
}

export function ABTestingTab() {
  const { data, stores, isLoading, error, fetchStores, fetchAnalytics } = useABTestingAnalytics();

  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [storesInitialized, setStoresInitialized] = useState(false);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    const loadInitialData = async () => {
      await fetchStores();
      await fetchAnalytics(undefined, 'all');
      setLastUpdated(new Date());
    };
    loadInitialData();
  }, [fetchStores, fetchAnalytics]);

  useEffect(() => {
    if (error) {
      toast.error('Failed to load A/B testing data', { description: error });
    }
  }, [error]);

  const handleRefresh = async () => {
    await fetchAnalytics(undefined, 'all');
    setLastUpdated(new Date());
    toast.success('Data refreshed');
  };

  const exportToCSV = () => {
    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
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

  // Build store list for MultiStoreSelector, labeling AB-enabled stores (>1 design)
  const allStoreOptions: Store[] = useMemo(() => {
    return data.map(item => {
      const isAB = item.variants.length > 1;
      return {
        id: item.store,
        name: `${getDisplayStoreName(item.store)}${isAB ? ' (AB)' : ''}`,
      };
    });
  }, [data]);

  // Auto-select AB-enabled stores on first data load
  useEffect(() => {
    if (data.length > 0 && !storesInitialized) {
      const abIds = data.filter(item => item.variants.length > 1).map(item => item.store);
      setSelectedStoreIds(abIds.length > 0 ? abIds : data.map(item => item.store));
      setStoresInitialized(true);
    }
  }, [data, storesInitialized]);

  const toggleStore = useCallback((storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  }, []);

  const selectAllStores = useCallback(() => {
    setSelectedStoreIds(allStoreOptions.map(s => s.id));
  }, [allStoreOptions]);

  const unselectAllStores = useCallback(() => {
    setSelectedStoreIds([]);
  }, []);

  // Filter data based on selected stores
  const filteredData = useMemo(() => {
    if (selectedStoreIds.length === 0) return [];
    return data.filter(item => selectedStoreIds.includes(item.store));
  }, [data, selectedStoreIds]);

  const storesWithAB = filteredData.filter(item => item.variants.length > 1);
  const storesWithoutAB = filteredData.filter(item => item.variants.length <= 1);

  // Aggregated design data across all stores
  const { aggregates, designAggregates, rankedDesigns } = useMemo(() => {
    const totalCheckouts = filteredData.reduce((sum, d) => sum + (d.total_checkouts || 0), 0);
    const totalOptIns = filteredData.reduce((sum, d) => sum + (d.opt_ins || 0), 0);
    const totalOptOuts = filteredData.reduce((sum, d) => sum + (d.opt_outs || 0), 0);
    const optInRate = totalCheckouts > 0 ? (totalOptIns / totalCheckouts) * 100 : 0;
    const activeStores = storesWithAB.length;

    const designAgg: Record<string, { ins: number; outs: number; total: number }> = {};
    filteredData.forEach(d => d.variants.forEach(v => {
      if (!designAgg[v.name]) designAgg[v.name] = { ins: 0, outs: 0, total: 0 };
      designAgg[v.name].ins += v.opt_ins;
      designAgg[v.name].outs += v.opt_outs;
      designAgg[v.name].total += v.total;
    }));

    const designAggregates: DesignAggregate[] = DESIGN_LABELS.map(name => {
      const d = designAgg[name] || { ins: 0, outs: 0, total: 0 };
      return {
        name,
        total: d.total,
        opt_ins: d.ins,
        opt_outs: d.outs,
        opt_in_rate: d.total > 0 ? (d.ins / d.total) * 100 : 0,
      };
    });

    const rankedDesigns = [...designAggregates]
      .filter(d => d.total > 0)
      .sort((a, b) => b.opt_in_rate - a.opt_in_rate);

    let bestDesign = '—';
    let bestRate = 0;
    if (rankedDesigns.length > 0) {
      bestDesign = rankedDesigns[0].name;
      bestRate = rankedDesigns[0].opt_in_rate;
    }

    return {
      aggregates: { totalCheckouts, totalOptIns, totalOptOuts, optInRate, activeStores, bestDesign, bestRate },
      designAggregates,
      rankedDesigns,
    };
  }, [filteredData, storesWithAB]);

  // Chart data
  const chartData = useMemo(() => {
    return designAggregates
      .filter(d => d.total > 0)
      .map(d => ({
        name: d.name.length > 15 ? d.name.substring(0, 14) + '…' : d.name,
        fullName: d.name,
        'Opt-ins': d.opt_ins,
        'Opt-outs': d.opt_outs,
        Total: d.total,
        'Opt-in Rate': Number(d.opt_in_rate.toFixed(1)),
      }));
  }, [designAggregates]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="icon-glow">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">A/B Testing</h2>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
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
        <div className="flex items-center gap-3 flex-wrap">
          <MultiStoreSelector
            stores={allStoreOptions}
            selectedStores={selectedStoreIds}
            onToggleStore={toggleStore}
            onSelectAll={selectAllStores}
            onUnselectAll={unselectAllStores}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Compact Horizontal Aggregate Widgets */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Checkouts', value: aggregates.totalCheckouts.toLocaleString(), icon: <ShoppingCart className="h-3.5 w-3.5" /> },
          { label: 'Opt-ins', value: aggregates.totalOptIns.toLocaleString(), icon: <ThumbsUp className="h-3.5 w-3.5" />, highlight: true },
          { label: 'Opt-outs', value: aggregates.totalOptOuts.toLocaleString(), icon: <ThumbsDown className="h-3.5 w-3.5" /> },
          
          { label: 'AB Stores', value: String(aggregates.activeStores), icon: <StoreIcon className="h-3.5 w-3.5" /> },
          { label: 'Best Design', value: aggregates.bestDesign, icon: <Trophy className="h-3.5 w-3.5" />, highlight: true },
        ].map((widget, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
              widget.highlight
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-card'
            }`}
          >
            <span className="text-muted-foreground">{widget.icon}</span>
            <span className="text-muted-foreground whitespace-nowrap">{widget.label}</span>
            <span className="font-semibold text-foreground">{widget.value}</span>
          </div>
        ))}
      </div>

      {isLoading && data.length === 0 ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Bar Chart + Ranking side by side */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Bar Chart */}
              <div className="data-table lg:col-span-2">
                <div className="border-b border-border p-4">
                  <h3 className="text-base font-semibold text-foreground">Design Performance</h3>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'hsl(var(--foreground))',
                        }}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item?.fullName || label;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="Opt-ins" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Opt-outs" fill="hsl(var(--muted-foreground) / 0.4)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Design Ranking */}
              <div className="data-table">
                <div className="border-b border-border p-4">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Medal className="h-4 w-4 text-primary" />
                    Design Ranking
                  </h3>
                </div>
                <div className="p-3 space-y-2">
                  {rankedDesigns.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                  ) : (
                    rankedDesigns.map((design, i) => {
                      const maxTotal = rankedDesigns[0]?.total || 1;
                      const barWidth = Math.max((design.total / maxTotal) * 100, 8);
                      return (
                        <div key={design.name} className="group">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              i === 0 ? 'bg-primary text-primary-foreground' :
                              i === 1 ? 'bg-primary/20 text-primary' :
                              'bg-secondary text-muted-foreground'
                            }`}>
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium text-foreground truncate flex-1" title={design.name}>
                              {design.name}
                            </span>
                            <span className={`text-sm font-semibold ${
                              i === 0 ? 'text-primary' : 'text-foreground'
                            }`}>
                              {design.opt_in_rate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="ml-8 flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary/60 transition-all duration-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {design.opt_ins}/{design.total}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

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
