import { useState, useEffect } from 'react';
import { QrCode, Search, Package, Clock, ArrowDownUp, Truck, RotateCcw, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface LabelRecord {
  id: string;
  label_id: string;
  status: string;
  group_id: string | null;
  previous_uses: number;
  current_order_id: string | null;
  created_at: string;
  updated_at: string;
}

interface GroupRecord {
  id: string;
  group_id: string;
  label_count: number;
  status: string;
  created_at: string;
}

interface MintsoftASN {
  id: string;
  packaging_id: string | null;
  product_name: string | null;
  asn_status: string | null;
  po_reference: string | null;
  estimated_delivery: string | null;
  booked_in_date: string | null;
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

const statusColors: Record<string, string> = {
  available: 'bg-primary/10 text-primary',
  'in_use': 'bg-chart-total/10 text-chart-total',
  returned: 'bg-kvatt-brown/10 text-kvatt-brown',
  damaged: 'bg-destructive/10 text-destructive',
  pending: 'bg-muted text-muted-foreground',
};

const QRTracking = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Results
  const [labels, setLabels] = useState<LabelRecord[]>([]);
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [asnRecords, setAsnRecords] = useState<MintsoftASN[]>([]);
  const [returnRecords, setReturnRecords] = useState<MintsoftReturn[]>([]);

  // Stats
  const [totalPacks, setTotalPacks] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalASN, setTotalASN] = useState(0);
  const [totalReturns, setTotalReturns] = useState(0);

  // Load stats on mount
  useEffect(() => {
    const loadStats = async () => {
      const [labelsCount, groupsCount, asnCount, returnsCount] = await Promise.all([
        supabase.from('labels').select('id', { count: 'exact', head: true }),
        supabase.from('label_groups').select('id', { count: 'exact', head: true }),
        supabase.from('mintsoft_asn').select('id', { count: 'exact', head: true }),
        supabase.from('mintsoft_returns').select('id', { count: 'exact', head: true }),
      ]);
      setTotalPacks(labelsCount.count || 0);
      setTotalGroups(groupsCount.count || 0);
      setTotalASN(asnCount.count || 0);
      setTotalReturns(returnsCount.count || 0);
    };
    loadStats();
  }, []);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setSearching(true);
    setSearched(true);
    setLabels([]);
    setGroup(null);
    setAsnRecords([]);
    setReturnRecords([]);

    try {
      // 1. Search labels by pack ID (exact or partial match)
      const { data: labelData } = await supabase
        .from('labels')
        .select('*')
        .ilike('label_id', `%${query}%`)
        .limit(50);

      const foundLabels = labelData || [];
      setLabels(foundLabels);

      // Collect all pack IDs for Mintsoft lookup
      const packIds = foundLabels.map(l => l.label_id);

      // 2. If a label has a group_id, fetch the group
      const groupIds = [...new Set(foundLabels.map(l => l.group_id).filter(Boolean))];
      if (groupIds.length > 0) {
        const { data: groupData } = await supabase
          .from('label_groups')
          .select('*')
          .in('id', groupIds as string[])
          .limit(1);
        if (groupData && groupData.length > 0) {
          setGroup(groupData[0]);
          // Also search for other packs in the same group
          const { data: groupLabels } = await supabase
            .from('labels')
            .select('label_id')
            .in('group_id', groupIds as string[]);
          if (groupLabels) {
            groupLabels.forEach(gl => {
              if (!packIds.includes(gl.label_id)) packIds.push(gl.label_id);
            });
          }
        }
      }

      // 3. Also try searching label_groups by group_id string
      if (foundLabels.length === 0) {
        const { data: groupByName } = await supabase
          .from('label_groups')
          .select('*')
          .ilike('group_id', `%${query}%`)
          .limit(1);
        
        if (groupByName && groupByName.length > 0) {
          setGroup(groupByName[0]);
          // Fetch all labels in this group
          const { data: groupLabels } = await supabase
            .from('labels')
            .select('*')
            .eq('group_id', groupByName[0].id)
            .limit(50);
          if (groupLabels) {
            setLabels(groupLabels);
            groupLabels.forEach(gl => {
              if (!packIds.includes(gl.label_id)) packIds.push(gl.label_id);
            });
          }
        }
      }

      // 4. Search Mintsoft ASN by packaging_id matching any pack ID
      if (packIds.length > 0) {
        const { data: asnData } = await supabase
          .from('mintsoft_asn')
          .select('*')
          .in('packaging_id', packIds);
        setAsnRecords(asnData || []);
      }

      // Also search ASN directly by query
      const { data: asnDirect } = await supabase
        .from('mintsoft_asn')
        .select('*')
        .or(`packaging_id.ilike.%${query}%,po_reference.ilike.%${query}%`)
        .limit(50);
      if (asnDirect && asnDirect.length > 0) {
        setAsnRecords(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newRecords = asnDirect.filter(r => !existingIds.has(r.id));
          return [...prev, ...newRecords];
        });
      }

      // 5. Search Mintsoft Returns by reference/product_code matching pack IDs
      if (packIds.length > 0) {
        const { data: returnData } = await supabase
          .from('mintsoft_returns')
          .select('*')
          .or(packIds.map(id => `reference.eq.${id},product_code.eq.${id}`).join(','));
        setReturnRecords(returnData || []);
      }

      // Also search returns directly by query
      const { data: returnsDirect } = await supabase
        .from('mintsoft_returns')
        .select('*')
        .or(`reference.ilike.%${query}%,product_code.ilike.%${query}%,return_id.ilike.%${query}%`)
        .limit(50);
      if (returnsDirect && returnsDirect.length > 0) {
        setReturnRecords(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newRecords = returnsDirect.filter(r => !existingIds.has(r.id));
          return [...prev, ...newRecords];
        });
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy HH:mm'); } catch { return d; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">QR & Barcode Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Search by Pack ID or Group ID to see status and Mintsoft activity
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Packs</p>
              <p className="text-2xl font-semibold">{totalPacks.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Groups</p>
              <p className="text-2xl font-semibold">{totalGroups.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ASN Records</p>
              <p className="text-2xl font-semibold">{totalASN.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Returns</p>
              <p className="text-2xl font-semibold">{totalReturns.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
        className="flex gap-3 max-w-lg"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Enter Pack ID (e.g. KBB1c100005) or Group ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={searching || !searchQuery.trim()}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Search
        </Button>
      </form>

      {/* Results */}
      {searched && (
        <div className="space-y-6">
          {/* Group info */}
          {group && (
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Group: {group.group_id}</h3>
                <Badge variant="outline" className={statusColors[group.status] || 'bg-muted text-muted-foreground'}>
                  {group.status}
                </Badge>
              </div>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span>Labels: {group.label_count}</span>
                <span>Created: {formatDate(group.created_at)}</span>
              </div>
            </div>
          )}

          <Tabs defaultValue="packs" className="w-full">
            <TabsList>
              <TabsTrigger value="packs">
                Packs ({labels.length})
              </TabsTrigger>
              <TabsTrigger value="asn">
                ASN Activity ({asnRecords.length})
              </TabsTrigger>
              <TabsTrigger value="returns">
                Returns ({returnRecords.length})
              </TabsTrigger>
            </TabsList>

            {/* Packs Tab */}
            <TabsContent value="packs">
              {labels.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No packs found matching "{searchQuery}"</p>
                </div>
              ) : (
                <div className="data-table">
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
                          <TableCell className="font-mono text-muted-foreground">
                            {label.current_order_id || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(label.created_at)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(label.updated_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ASN Tab */}
            <TabsContent value="asn">
              {asnRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No Mintsoft ASN activity found for this pack/group</p>
                </div>
              ) : (
                <div className="data-table">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>Packaging ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>PO Reference</TableHead>
                        <TableHead>ASN Status</TableHead>
                        <TableHead>Est. Delivery</TableHead>
                        <TableHead>Booked In</TableHead>
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
                  <p>No Mintsoft return activity found for this pack/group</p>
                </div>
              ) : (
                <div className="data-table">
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
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default QRTracking;
