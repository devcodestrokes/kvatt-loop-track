import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AnalyticsData } from '@/types/analytics';
import { ArrowUpDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface DataTableProps {
  data: AnalyticsData[];
}

type SortField = 'store' | 'total_checkouts' | 'opt_ins' | 'opt_outs';
type SortDirection = 'asc' | 'desc';

export function DataTable({ data }: DataTableProps) {
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
    const headers = ['Store', 'Total Checkouts', 'Opt-ins', 'Opt-outs', 'Opt-in Rate'];
    const rows = data.map((item) => [
      item.store,
      item.total_checkouts,
      item.opt_ins,
      item.opt_outs,
      item.total_checkouts > 0
        ? `${((item.opt_ins / item.total_checkouts) * 100).toFixed(1)}%`
        : '0%',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kvatt-analytics-${new Date().toISOString().split('T')[0]}.csv`;
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((item, index) => {
                const optInRate =
                  item.total_checkouts > 0
                    ? ((item.opt_ins / item.total_checkouts) * 100).toFixed(1)
                    : '0';
                return (
                  <TableRow key={index} className="border-border hover:bg-secondary/50">
                    <TableCell className="font-medium text-foreground">
                      {item.store.replace('.myshopify.com', '')}
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
