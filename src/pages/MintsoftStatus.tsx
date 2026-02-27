import { useState, useEffect } from 'react';
import { Truck, RotateCcw, Package, QrCode, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import kvattLogo from '@/assets/kvatt-logo.jpeg';

interface MintsoftASN {
  id: string;
  packaging_id: string | null;
  product_name: string | null;
  asn_status: string | null;
  po_reference: string | null;
  estimated_delivery: string | null;
  booked_in_date: string | null;
  last_updated: string | null;
  synced_at: string;
}

interface MintsoftReturn {
  id: string;
  return_id: string | null;
  reference: string | null;
  product_code: string | null;
  return_date: string | null;
  reason: string | null;
  qty_returned: number;
  synced_at: string;
}

interface LabelRecord {
  id: string;
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
  const [asnRecords, setAsnRecords] = useState<MintsoftASN[]>([]);
  const [returnRecords, setReturnRecords] = useState<MintsoftReturn[]>([]);
  const [labels, setLabels] = useState<LabelRecord[]>([]);
  const [stats, setStats] = useState({ packs: 0, asn: 0, returns: 0 });

  const loadData = async () => {
    setLoading(true);
    try {
      const [asnRes, returnsRes, labelsRes, packsCount, asnCount, returnsCount] = await Promise.all([
        supabase.from('mintsoft_asn').select('*').order('synced_at', { ascending: false }).limit(200),
        supabase.from('mintsoft_returns').select('*').order('synced_at', { ascending: false }).limit(200),
        supabase.from('labels').select('*').order('updated_at', { ascending: false }).limit(200),
        supabase.from('labels').select('id', { count: 'exact', head: true }),
        supabase.from('mintsoft_asn').select('id', { count: 'exact', head: true }),
        supabase.from('mintsoft_returns').select('id', { count: 'exact', head: true }),
      ]);

      setAsnRecords(asnRes.data || []);
      setReturnRecords(returnsRes.data || []);
      setLabels(labelsRes.data || []);
      setStats({
        packs: packsCount.count || 0,
        asn: asnCount.count || 0,
        returns: returnsCount.count || 0,
      });
    } catch (err) {
      console.error('Failed to load Mintsoft data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy HH:mm'); } catch { return d; }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        <div className="grid gap-4 sm:grid-cols-3">
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="asn" className="w-full">
            <TabsList>
              <TabsTrigger value="asn">ASN Activity ({asnRecords.length})</TabsTrigger>
              <TabsTrigger value="returns">Returns ({returnRecords.length})</TabsTrigger>
              <TabsTrigger value="packs">Packs ({labels.length})</TabsTrigger>
            </TabsList>

            {/* ASN Tab */}
            <TabsContent value="asn">
              {asnRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No ASN records found</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>Packaging ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>PO Reference</TableHead>
                        <TableHead>ASN Status</TableHead>
                        <TableHead>Est. Delivery</TableHead>
                        <TableHead>Booked In</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Synced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asnRecords.map((asn) => (
                        <TableRow key={asn.id} className="border-border">
                          <TableCell className="font-mono font-medium">{asn.packaging_id || '—'}</TableCell>
                          <TableCell>{asn.product_name || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{asn.po_reference || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{asn.asn_status || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(asn.estimated_delivery)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(asn.booked_in_date)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(asn.last_updated)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(asn.synced_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Returns Tab */}
            <TabsContent value="returns">
              {returnRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RotateCcw className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No return records found</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>Return ID</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Product Code</TableHead>
                        <TableHead>Qty Returned</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Return Date</TableHead>
                        <TableHead>Synced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnRecords.map((ret) => (
                        <TableRow key={ret.id} className="border-border">
                          <TableCell className="font-mono font-medium">{ret.return_id || '—'}</TableCell>
                          <TableCell className="font-mono">{ret.reference || '—'}</TableCell>
                          <TableCell>{ret.product_code || '—'}</TableCell>
                          <TableCell>{ret.qty_returned}</TableCell>
                          <TableCell className="text-muted-foreground">{ret.reason || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(ret.return_date)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(ret.synced_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

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
                      {labels.map((label) => (
                        <TableRow key={label.id} className="border-border">
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
