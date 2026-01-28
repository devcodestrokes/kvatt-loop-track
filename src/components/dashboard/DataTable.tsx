import { useState } from 'react';
import { format, getISOWeek } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AnalyticsData, DateRange } from '@/types/analytics';
import { ArrowUpDown, Download, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getWidgetLabel, getWidgetConfig } from '@/config/widgetConfig';
import { getDisplayDomain } from '@/hooks/useAnalytics';

interface DataTableProps {
  data: AnalyticsData[];
  dateRange?: DateRange;
  showWidgetStatus?: boolean;
}

type SortField = 'store' | 'total_checkouts' | 'opt_ins' | 'opt_outs';
type SortDirection = 'asc' | 'desc';

export function DataTable({ data, dateRange, showWidgetStatus = true }: DataTableProps) {
  const [sortField, setSortField] = useState<SortField>('opt_ins');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortDirection === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  const exportToCSV = () => {
    const today = new Date();
    const weekNum = getISOWeek(today);
    const dateStr = dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}`
      : format(today, 'yyyy-MM-dd');
    
    const headers = ['Store', 'Date Range', 'ISO Week', 'Total Checkouts', 'Opt-ins', 'Opt-outs', 'Opt-in Rate', 'Widget Status'];
    const rows = data.map((item) => {
      const optInRate = item.total_checkouts > 0
        ? ((item.opt_ins / item.total_checkouts) * 100).toFixed(2)
        : '0.00';
      const widgetLabel = getWidgetLabel(item.store);
      
      return [
        getDisplayDomain(item.store),
        dateRange?.from && dateRange?.to 
          ? `${format(dateRange.from, 'yyyy-MM-dd')} to ${format(dateRange.to, 'yyyy-MM-dd')}`
          : format(today, 'yyyy-MM-dd'),
        `Week ${weekNum}`,
        item.total_checkouts,
        item.opt_ins,
        item.opt_outs,
        `${optInRate}%`,
        widgetLabel,
      ];
    });

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kvatt-analytics-${dateStr}.csv`;
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
    <div className="data-table">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="text-lg font-semibold text-foreground">Store Details</h3>
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
                <SortButton field="total_checkouts">Total Checkouts</SortButton>
              </TableHead>
              <TableHead className="text-right text-muted-foreground">
                <SortButton field="opt_ins">Opt-ins</SortButton>
              </TableHead>
              <TableHead className="text-right text-muted-foreground">
                <SortButton field="opt_outs">Opt-outs</SortButton>
              </TableHead>
              <TableHead className="text-right text-muted-foreground">Opt-in Rate</TableHead>
              {showWidgetStatus && (
                <TableHead className="text-muted-foreground">
                  <div className="flex items-center gap-1">
                    Widget Status
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Read-only widget configuration</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showWidgetStatus ? 6 : 5} className="h-24 text-center text-muted-foreground">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((item, index) => {
                const optInRate =
                  item.total_checkouts > 0
                    ? ((item.opt_ins / item.total_checkouts) * 100).toFixed(2)
                    : '0.00';
                const widgetConfig = getWidgetConfig(item.store);
                
                return (
                  <TableRow key={index} className="border-border hover:bg-secondary/50">
                    <TableCell className="font-medium text-foreground">
                      {getDisplayDomain(item.store)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-foreground">
                      {item.total_checkouts.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-primary">
                      {item.opt_ins.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {item.opt_outs.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          parseFloat(optInRate) >= 50
                            ? 'bg-primary/10 text-primary'
                            : parseFloat(optInRate) >= 25
                            ? 'bg-chart-total/10 text-chart-total'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {optInRate}%
                      </span>
                    </TableCell>
                    {showWidgetStatus && (
                      <TableCell>
                        {widgetConfig ? (
                          <Badge variant="outline" className="text-xs">
                            {widgetConfig.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not configured</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
