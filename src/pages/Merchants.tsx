import { useState, useEffect } from 'react';
import { Store, Plus, Search, MoreHorizontal, Package, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface Merchant {
  id: string;
  name: string;
  shopifyDomain: string;
  totalOptIns: number;
  totalCheckouts: number;
  optInRate: number;
  status: 'active' | 'pending' | 'inactive';
}

interface AnalyticsData {
  store: string;
  total_checkouts: number;
  opt_ins: number;
  opt_outs: number;
}

const statusColors = {
  active: 'bg-primary/10 text-primary',
  pending: 'bg-chart-total/10 text-chart-total',
  inactive: 'bg-muted text-muted-foreground',
};

const formatStoreName = (domain: string): string => {
  // Extract store name from domain (e.g., "toast-uk.myshopify.com" -> "Toast UK")
  const storePart = domain.replace('.myshopify.com', '');
  return storePart
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const Merchants = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newMerchant, setNewMerchant] = useState({ name: '', shopifyDomain: '' });

  const fetchMerchants = async () => {
    setIsLoading(true);
    try {
      // Fetch stores and analytics data in parallel
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [storesRes, analyticsRes] = await Promise.all([
        fetch('https://shopify.kvatt.com/api/get-stores', {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer %^75464tnfsdhndsfbgr54'
          }
        }),
        fetch(`https://shopify.kvatt.com/api/get-alaytics?store=all&start_date=${startDate}&end_date=${endDate}`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer %^75464tnfsdhndsfbgr54'
          }
        })
      ]);

      const storesData = await storesRes.json();
      const analyticsData = await analyticsRes.json();

      if (storesData.status === 200 && storesData.data) {
        const analyticsMap = new Map<string, AnalyticsData>();
        if (analyticsData.status === 200 && analyticsData.data) {
          analyticsData.data.forEach((item: AnalyticsData) => {
            analyticsMap.set(item.store, item);
          });
        }

        const merchantsData: Merchant[] = storesData.data.map((domain: string, index: number) => {
          const analytics = analyticsMap.get(domain);
          const totalCheckouts = analytics?.total_checkouts || 0;
          const optIns = analytics?.opt_ins || 0;
          const optInRate = totalCheckouts > 0 ? Math.round((optIns / totalCheckouts) * 100) : 0;
          
          // Determine status based on activity
          let status: 'active' | 'pending' | 'inactive' = 'inactive';
          if (totalCheckouts > 0) {
            status = 'active';
          } else {
            status = 'pending';
          }

          return {
            id: String(index + 1),
            name: formatStoreName(domain),
            shopifyDomain: domain,
            totalOptIns: optIns,
            totalCheckouts: totalCheckouts,
            optInRate: optInRate,
            status: status,
          };
        });

        setMerchants(merchantsData);
      }
    } catch (error) {
      console.error('Error fetching merchants:', error);
      toast.error('Failed to fetch merchants');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const filteredMerchants = merchants.filter(
    (merchant) =>
      merchant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      merchant.shopifyDomain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMerchant = () => {
    if (!newMerchant.name || !newMerchant.shopifyDomain) {
      toast.error('Please fill in all fields');
      return;
    }

    const merchant: Merchant = {
      id: String(merchants.length + 1),
      name: newMerchant.name,
      shopifyDomain: newMerchant.shopifyDomain,
      totalOptIns: 0,
      totalCheckouts: 0,
      optInRate: 0,
      status: 'pending',
    };

    setMerchants([merchant, ...merchants]);
    setNewMerchant({ name: '', shopifyDomain: '' });
    setIsAdding(false);
    toast.success('Merchant added successfully');
  };

  const totalMerchants = merchants.length;
  const activeMerchants = merchants.filter(m => m.status === 'active').length;
  const totalOptIns = merchants.reduce((acc, m) => acc + m.totalOptIns, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Merchants</h1>
          <p className="text-sm text-muted-foreground">
            Manage merchants using Kvatt renewable packaging
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchMerchants} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Merchant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Merchant</DialogTitle>
                <DialogDescription>
                  Connect a new Shopify store to Kvatt packaging.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="merchantName">Merchant Name</Label>
                  <Input
                    id="merchantName"
                    value={newMerchant.name}
                    onChange={(e) => setNewMerchant({ ...newMerchant, name: e.target.value })}
                    placeholder="e.g., EcoStore UK"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="shopifyDomain">Shopify Domain</Label>
                  <Input
                    id="shopifyDomain"
                    value={newMerchant.shopifyDomain}
                    onChange={(e) => setNewMerchant({ ...newMerchant, shopifyDomain: e.target.value })}
                    placeholder="e.g., store-name.myshopify.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
                <Button onClick={handleAddMerchant}>Add Merchant</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Merchants</p>
              <p className="text-2xl font-semibold">
                {isLoading ? <Skeleton className="h-8 w-12" /> : totalMerchants}
              </p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Merchants</p>
              <p className="text-2xl font-semibold">
                {isLoading ? <Skeleton className="h-8 w-12" /> : activeMerchants}
              </p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Opt-ins</p>
              <p className="text-2xl font-semibold">
                {isLoading ? <Skeleton className="h-8 w-12" /> : totalOptIns.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search merchants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Store Name</TableHead>
              <TableHead>Shopify Domain</TableHead>
              <TableHead className="text-right">Total Opt-ins</TableHead>
              <TableHead className="text-right">Checkouts</TableHead>
              <TableHead className="text-right">Opt-in Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredMerchants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No merchants found
                </TableCell>
              </TableRow>
            ) : (
              filteredMerchants.map((merchant) => (
                <TableRow key={merchant.id} className="border-border">
                  <TableCell className="font-medium">{merchant.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {merchant.shopifyDomain}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {merchant.totalOptIns.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {merchant.totalCheckouts.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      merchant.optInRate >= 5 ? 'bg-primary/10 text-primary' :
                      merchant.optInRate >= 1 ? 'bg-chart-total/10 text-chart-total' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {merchant.optInRate}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[merchant.status]}`}>
                      {merchant.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>View Analytics</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Merchants;
