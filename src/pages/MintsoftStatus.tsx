import { useState, useEffect, useMemo, Fragment } from 'react';
import { Truck, RotateCcw, QrCode, Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import kvattLogo from '@/assets/kvatt-logo.jpeg';

const PAGE_SIZES = [25, 50, 100, 200];

function PaginationControls({ total, page, pageSize, onPageChange, onPageSizeChange }: {
  total: number; page: number; pageSize: number;
  onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page:</span>
        <Select value={String(pageSize)} onValueChange={(v) => { onPageSizeChange(Number(v)); onPageChange(1); }}>
          <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
          <SelectContent>{PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface ASNItem {
  sku: string | null;
  name: string | null;
  expected_quantity: number;
  quantity_received: number;
  quantity_booked: number;
  comments: string | null;
  last_updated: string | null;
  last_updated_by_user: string | null;
}

interface ASNRecord {
  id: number | string | null;
  client: string | null;
  asn_status: string;
  warehouse: string | null;
  supplier: string | null;
  po_reference: string;
  estimated_delivery: string | null;
  comments: string | null;
  goods_in_type: string | null;
  quantity: number | null;
  last_updated: string | null;
  last_updated_by_user: string | null;
  booked_in_date: string | null;
  items: ASNItem[];
}

interface ReturnItem {
  product_code: string;
  product_name: string;
  quantity: number;
  reason: string;
  comments: string;
  expiry_date: string | null;
  batch: string;
  serial: string;
  last_updated: string | null;
  last_updated_by_user: string | null;
}

interface ReturnRecord {
  return_id: string;
  reference: string;
  order_number: string;
  client: string;
  return_type: string;
  confirmed: boolean;
  refunded: boolean;
  exchanged: boolean;
  invoiced: boolean;
  last_updated: string | null;
  last_updated_by_user: string | null;
  return_items: ReturnItem[];
}

interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  quantity_committed: number;
  quantity_allocated: number;
  price_ex_vat: number;
  vat: number;
  last_updated: string | null;
  last_updated_by_user: string | null;
}

interface OrderRecord {
  id: number | string | null;
  order_number: string;
  client: string | null;
  channel: string | null;
  status: string;
  warehouse: string | null;
  courier: string | null;
  courier_service: string | null;
  tracking_number: string | null;
  recipient_name: string | null;
  destination_country: string | null;
  postcode: string | null;
  weight: number | null;
  total_items: number | null;
  num_parcels: number | null;
  parts: string | null;
  order_date: string | null;
  dispatched_date: string | null;
  last_updated: string | null;
  last_updated_by_user: string | null;
  comments: string | null;
  order_lock: boolean;
  items: OrderItem[];
}

interface LabelRecord {
  label_id: string;
  status: string;
  previous_uses: number;
  current_order_id: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  available: 'bg-primary/10 text-primary',
  in_use: 'bg-chart-total/10 text-chart-total',
  returned: 'bg-kvatt-brown/10 text-kvatt-brown',
  damaged: 'bg-destructive/10 text-destructive',
};

const MintsoftStatus = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asnRecords, setAsnRecords] = useState<ASNRecord[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [orderRecords, setOrderRecords] = useState<OrderRecord[]>([]);
  const [labels, setLabels] = useState<LabelRecord[]>([]);
  const [stats, setStats] = useState({ packs: 0, asn: 0, returns: 0, orders: 0 });
  const [expandedAsnRows, setExpandedAsnRows] = useState<Set<number>>(new Set());
  const [expandedReturnRows, setExpandedReturnRows] = useState<Set<number>>(new Set());
  const [expandedOrderRows, setExpandedOrderRows] = useState<Set<number>>(new Set());

  const toggleAsnRow = (index: number) => {
    setExpandedAsnRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleReturnRow = (index: number) => {
    setExpandedReturnRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleOrderRow = (index: number) => {
    setExpandedOrderRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const [packsPage, setPacksPage] = useState(1);
  const [packsPageSize, setPacksPageSize] = useState(50);
  const [asnPage, setAsnPage] = useState(1);
  const [asnPageSize, setAsnPageSize] = useState(50);
  const [returnsPage, setReturnsPage] = useState(1);
  const [returnsPageSize, setReturnsPageSize] = useState(50);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(50);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-mintsoft-status');
      
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setAsnRecords(data.asn || []);
      setReturnRecords(data.returns || []);
      setOrderRecords(data.orders || []);
      setLabels(data.labels || []);
      setStats({
        packs: data.stats?.packs_count || 0,
        asn: data.stats?.asn_count || 0,
        returns: data.stats?.returns_count || 0,
        orders: data.stats?.orders_count || 0,
      });
      setPacksPage(1); setAsnPage(1); setReturnsPage(1); setOrdersPage(1);
    } catch (err: any) {
      console.error('Failed to load Mintsoft data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const pagedLabels = useMemo(() => labels.slice((packsPage - 1) * packsPageSize, packsPage * packsPageSize), [labels, packsPage, packsPageSize]);
  const pagedAsn = useMemo(() => asnRecords.slice((asnPage - 1) * asnPageSize, asnPage * asnPageSize), [asnRecords, asnPage, asnPageSize]);
  const pagedReturns = useMemo(() => returnRecords.slice((returnsPage - 1) * returnsPageSize, returnsPage * returnsPageSize), [returnRecords, returnsPage, returnsPageSize]);
  const pagedOrders = useMemo(() => orderRecords.slice((ordersPage - 1) * ordersPageSize, ordersPage * ordersPageSize), [orderRecords, ordersPage, ordersPageSize]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy HH:mm'); } catch { return d; }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={kvattLogo} alt="Kvatt" className="h-8 w-8 rounded" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Mintsoft Status</h1>
              <p className="text-xs text-muted-foreground">Live packaging & logistics overview</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Packs</p>
                <p className="text-2xl font-semibold">{stats.packs.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ASN Records</p>
                <p className="text-2xl font-semibold">{stats.asn.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Returns</p>
                <p className="text-2xl font-semibold">{stats.returns.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="text-2xl font-semibold">{stats.orders.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
            Error: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="asn" className="w-full">
            <TabsList>
              <TabsTrigger value="packs">Packs ({labels.length})</TabsTrigger>
              <TabsTrigger value="asn">ASN Activity ({asnRecords.length})</TabsTrigger>
              <TabsTrigger value="returns">Returns ({returnRecords.length})</TabsTrigger>
              <TabsTrigger value="orders">Orders ({orderRecords.length})</TabsTrigger>
            </TabsList>

            {/* Packs Tab */}
            <TabsContent value="packs">
              {labels.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No packs found</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>Pack ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Uses</TableHead>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedLabels.map((label, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="font-mono font-medium">{label.label_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColors[label.status] || 'bg-muted text-muted-foreground'}>
                              {label.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{label.previous_uses}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{label.current_order_id || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(label.created_at)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(label.updated_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls total={labels.length} page={packsPage} pageSize={packsPageSize} onPageChange={setPacksPage} onPageSizeChange={setPacksPageSize} />
                </div>
              )}
            </TabsContent>

            {/* ASN Tab */}
            <TabsContent value="asn">
              {asnRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No ASN records from Mintsoft</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="w-10"></TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>POReference</TableHead>
                        <TableHead>Estimated Delivery</TableHead>
                        <TableHead>Comments</TableHead>
                        <TableHead>GoodsIn Type</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Last Updated By User</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedAsn.map((asn, i) => {
                        const globalIndex = (asnPage - 1) * asnPageSize + i;
                        const isExpanded = expandedAsnRows.has(globalIndex);
                        const hasItems = asn.items && asn.items.length > 0;
                        return (
                          <Fragment key={globalIndex}>
                            <TableRow
                              className={`border-border ${hasItems ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                              onClick={() => hasItems && toggleAsnRow(globalIndex)}
                            >
                              <TableCell className="w-10 px-2">
                                {hasItems && (
                                  isExpanded
                                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="font-mono font-medium">{asn.id ?? '—'}</TableCell>
                              <TableCell>{asn.client || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{asn.asn_status || 'Unknown'}</Badge>
                              </TableCell>
                              <TableCell>{asn.warehouse || '—'}</TableCell>
                              <TableCell>{asn.supplier || '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{asn.po_reference || '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(asn.estimated_delivery)}</TableCell>
                              <TableCell className="text-muted-foreground max-w-[200px] truncate">{asn.comments || '—'}</TableCell>
                              <TableCell>{asn.goods_in_type || '—'}</TableCell>
                              <TableCell>{asn.quantity ?? '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(asn.last_updated)}</TableCell>
                              <TableCell className="text-muted-foreground">{asn.last_updated_by_user || '—'}</TableCell>
                            </TableRow>
                            {isExpanded && hasItems && (
                              <TableRow className="bg-muted/30 border-border">
                                <TableCell colSpan={13} className="p-0">
                                  <div className="px-6 py-3">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="border-border hover:bg-transparent">
                                          <TableHead className="text-xs font-semibold text-muted-foreground">SKU</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Name</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Expected Quantity</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Quantity Received</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Quantity Booked</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Comments</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Last Updated</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Last Updated By User</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {asn.items.map((item, j) => (
                                          <TableRow key={j} className="border-border">
                                            <TableCell className="font-mono text-sm">{item.sku || '—'}</TableCell>
                                            <TableCell className="text-sm">{item.name || '—'}</TableCell>
                                            <TableCell className="text-sm">{item.expected_quantity}</TableCell>
                                            <TableCell className="text-sm">{item.quantity_received}</TableCell>
                                            <TableCell className="text-sm">{item.quantity_booked}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{item.comments || '—'}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{formatDate(item.last_updated)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{item.last_updated_by_user || '—'}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <PaginationControls total={asnRecords.length} page={asnPage} pageSize={asnPageSize} onPageChange={setAsnPage} onPageSizeChange={setAsnPageSize} />
                </div>
              )}
            </TabsContent>

            {/* Returns Tab */}
            <TabsContent value="returns">
              {returnRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RotateCcw className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No return records from Mintsoft</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Return ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Confirmed</TableHead>
                        <TableHead>Refunded</TableHead>
                        <TableHead>Exchanged</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Last Updated By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedReturns.map((ret, i) => {
                        const globalIndex = (returnsPage - 1) * returnsPageSize + i;
                        const isExpanded = expandedReturnRows.has(globalIndex);
                        const hasItems = ret.return_items && ret.return_items.length > 0;
                        return (
                          <Fragment key={globalIndex}>
                            <TableRow
                              className={`border-border ${hasItems ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                              onClick={() => hasItems && toggleReturnRow(globalIndex)}
                            >
                              <TableCell className="w-10 px-2">
                                {hasItems && (
                                  isExpanded
                                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="font-mono font-medium">{ret.return_id || '—'}</TableCell>
                              <TableCell>{ret.client || '—'}</TableCell>
                              <TableCell>{ret.return_type || '—'}</TableCell>
                              <TableCell className="font-mono">{ret.reference || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={ret.confirmed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}>
                                  {ret.confirmed ? 'Yes' : 'No'}
                                </Badge>
                              </TableCell>
                              <TableCell>{ret.refunded ? 'Yes' : 'No'}</TableCell>
                              <TableCell>{ret.exchanged ? 'Yes' : 'No'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={ret.confirmed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}>
                                  {ret.confirmed ? 'Returned' : 'Pending'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(ret.last_updated)}</TableCell>
                              <TableCell className="text-muted-foreground">{ret.last_updated_by_user || '—'}</TableCell>
                            </TableRow>
                            {isExpanded && hasItems && (
                              <TableRow className="bg-muted/30 border-border">
                                <TableCell colSpan={11} className="p-0">
                                  <div className="px-6 py-3">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="border-border hover:bg-transparent">
                                          <TableHead className="text-xs font-semibold text-muted-foreground">SKU</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Name</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Quantity</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Reason</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Comments</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Expiry Date</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Batch</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Serial</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Last Updated</TableHead>
                                          <TableHead className="text-xs font-semibold text-muted-foreground">Last Updated By</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {ret.return_items.map((item, j) => (
                                          <TableRow key={j} className="border-border">
                                            <TableCell className="font-mono text-sm">{item.product_code || '—'}</TableCell>
                                            <TableCell className="text-sm">{item.product_name || '—'}</TableCell>
                                            <TableCell className="text-sm">{item.quantity}</TableCell>
                                            <TableCell className="text-sm">{item.reason || '—'}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{item.comments || '—'}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{formatDate(item.expiry_date)}</TableCell>
                                            <TableCell className="text-sm">{item.batch || '—'}</TableCell>
                                            <TableCell className="text-sm">{item.serial || '—'}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{formatDate(item.last_updated)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{item.last_updated_by_user || '—'}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <PaginationControls total={returnRecords.length} page={returnsPage} pageSize={returnsPageSize} onPageChange={setReturnsPage} onPageSizeChange={setReturnsPageSize} />
                </div>
              )}
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              {orderRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No order records from Mintsoft</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>ID</TableHead>
                        <TableHead>Order Number</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Postcode</TableHead>
                        <TableHead>Courier</TableHead>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Dispatched</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Comments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedOrders.map((order, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="font-mono font-medium">{order.id ?? '—'}</TableCell>
                          <TableCell className="font-mono">{order.order_number || '—'}</TableCell>
                          <TableCell>{order.client || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.status || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>{order.recipient_name || '—'}</TableCell>
                          <TableCell>{order.destination_country || '—'}</TableCell>
                          <TableCell>{order.postcode || '—'}</TableCell>
                          <TableCell>{order.courier || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{order.tracking_number || '—'}</TableCell>
                          <TableCell>{order.total_items ?? '—'}</TableCell>
                          <TableCell>{order.weight ? `${order.weight}g` : '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(order.dispatched_date)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(order.last_updated)}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">{order.comments || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls total={orderRecords.length} page={ordersPage} pageSize={ordersPageSize} onPageChange={setOrdersPage} onPageSizeChange={setOrdersPageSize} />
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default MintsoftStatus;
