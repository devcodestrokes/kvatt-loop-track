import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowUpDown, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface OptInOrder {
  id: string;
  order_number: string | null;
  total_price: number | null;
  shopify_created_at: string | null;
  store_id: string | null;
  payment_status: string | null;
  city: string | null;
  country: string | null;
}

interface OptInsDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStores: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

type SortField = 'order_number' | 'total_price' | 'shopify_created_at' | 'store_id';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 150, 200] as const;

export function OptInsDetailView({
  open,
  onOpenChange,
  selectedStores,
  dateFrom,
  dateTo
}: OptInsDetailViewProps) {
  const [orders, setOrders] = useState<OptInOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('shopify_created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (open) {
      fetchOptInOrders();
    }
  }, [open, selectedStores, dateFrom, dateTo]);

  // Reset to first page when page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const fetchOptInOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('imported_orders')
        .select('id, order_number, total_price, shopify_created_at, store_id, payment_status, city, country')
        .eq('opt_in', true)
        .order('shopify_created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Error fetching opt-in orders:', error);
        setOrders([]);
      } else {
        setOrders(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setOrders([]);
    } finally {
      setIsLoading(false);
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

  const sortedOrders = [...orders].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (aValue === null) aValue = '' as any;
    if (bValue === null) bValue = '' as any;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortDirection === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedOrders.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

  const exportToCSV = () => {
    const headers = ['Order ID', 'Order Value', 'Timestamp', 'Store', 'Payment Status', 'City', 'Country'];
    const rows = sortedOrders.map((order) => [
      order.order_number || '-',
      order.total_price?.toFixed(2) || '0.00',
      order.shopify_created_at ? format(new Date(order.shopify_created_at), 'yyyy-MM-dd HH:mm') : '-',
      order.store_id?.replace('.myshopify.com', '') || '-',
      order.payment_status || '-',
      order.city || '-',
      order.country || '-',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kvatt-optins-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">Opt-in Orders</SheetTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {orders.length} opt-in orders found
          </p>
        </SheetHeader>

        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-muted-foreground">
                  <SortButton field="order_number">Order ID</SortButton>
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  <SortButton field="total_price">Value</SortButton>
                </TableHead>
                <TableHead className="text-muted-foreground">
                  <SortButton field="shopify_created_at">Timestamp</SortButton>
                </TableHead>
                <TableHead className="text-muted-foreground">
                  <SortButton field="store_id">Store</SortButton>
                </TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No opt-in orders found for the selected filters
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map((order) => (
                  <TableRow key={order.id} className="border-border hover:bg-secondary/50">
                    <TableCell className="font-mono text-sm">
                      {order.order_number || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${order.total_price?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {order.shopify_created_at
                        ? format(new Date(order.shopify_created_at), 'MMM d, yyyy HH:mm')
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.store_id?.replace('.myshopify.com', '') || '-'}
                    </TableCell>
                    <TableCell>
                      {order.payment_status && (
                        <Badge
                          variant={order.payment_status === 'paid' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {order.payment_status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[order.city, order.country].filter(Boolean).join(', ') || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {!isLoading && orders.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => setPageSize(Number(value))}
              >
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {startIndex + 1}-{Math.min(endIndex, sortedOrders.length)} of {sortedOrders.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}