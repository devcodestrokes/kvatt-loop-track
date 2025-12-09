import { useState } from 'react';
import { Store, Plus, Search, MoreHorizontal, Package, TrendingUp, Users } from 'lucide-react';
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

interface Merchant {
  id: string;
  name: string;
  shopifyDomain: string;
  totalOptIns: number;
  totalPackages: number;
  returnRate: number;
  status: 'active' | 'pending' | 'inactive';
  joinedAt: string;
}

const mockMerchants: Merchant[] = [
  { id: '1', name: 'EcoStore UK', shopifyDomain: 'ecosore-uk.myshopify.com', totalOptIns: 2450, totalPackages: 1200, returnRate: 78, status: 'active', joinedAt: '2023-11-15' },
  { id: '2', name: 'Green Fashion', shopifyDomain: 'green-fashion.myshopify.com', totalOptIns: 1890, totalPackages: 850, returnRate: 65, status: 'active', joinedAt: '2023-12-01' },
  { id: '3', name: 'Sustainable Home', shopifyDomain: 'sustainable-home.myshopify.com', totalOptIns: 980, totalPackages: 420, returnRate: 72, status: 'active', joinedAt: '2024-01-05' },
  { id: '4', name: 'Eco Essentials', shopifyDomain: 'eco-essentials.myshopify.com', totalOptIns: 450, totalPackages: 180, returnRate: 58, status: 'pending', joinedAt: '2024-01-18' },
];

const statusColors = {
  active: 'bg-primary/10 text-primary',
  pending: 'bg-chart-total/10 text-chart-total',
  inactive: 'bg-muted text-muted-foreground',
};

const Merchants = () => {
  const [merchants, setMerchants] = useState<Merchant[]>(mockMerchants);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newMerchant, setNewMerchant] = useState({ name: '', shopifyDomain: '' });

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
      totalPackages: 0,
      returnRate: 0,
      status: 'pending',
      joinedAt: new Date().toISOString().split('T')[0],
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Merchants</p>
              <p className="text-2xl font-semibold">{totalMerchants}</p>
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
              <p className="text-2xl font-semibold">{activeMerchants}</p>
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
              <p className="text-2xl font-semibold">{totalOptIns.toLocaleString()}</p>
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
              <TableHead>Merchant</TableHead>
              <TableHead>Shopify Domain</TableHead>
              <TableHead className="text-right">Total Opt-ins</TableHead>
              <TableHead className="text-right">Packages</TableHead>
              <TableHead className="text-right">Return Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMerchants.map((merchant) => (
              <TableRow key={merchant.id} className="border-border">
                <TableCell className="font-medium">{merchant.name}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {merchant.shopifyDomain}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {merchant.totalOptIns.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {merchant.totalPackages.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    merchant.returnRate >= 70 ? 'bg-primary/10 text-primary' :
                    merchant.returnRate >= 50 ? 'bg-chart-total/10 text-chart-total' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {merchant.returnRate}%
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Merchants;
