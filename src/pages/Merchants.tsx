import { useState, useEffect } from 'react';
import { Store, Plus, Search, MoreHorizontal, TrendingUp, Users, RefreshCw, Pencil, ExternalLink, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface MerchantConfig {
  id?: string;
  logo_url?: string | null;
  contact_email?: string | null;
  return_link?: string | null;
  return_link_params?: string | null;
}

interface Merchant {
  id: string;
  name: string;
  shopifyDomain: string;
  totalOptIns: number;
  totalCheckouts: number;
  optInRate: number;
  status: 'active' | 'pending' | 'inactive';
  // DB config
  dbId?: string;
  logo_url?: string | null;
  contact_email?: string | null;
  return_link?: string | null;
  return_link_params?: string | null;
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
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    contact_email: string;
    logo_url: string;
    return_link: string;
    return_link_params: string;
  }>({ name: '', contact_email: '', logo_url: '', return_link: '', return_link_params: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchMerchants = async () => {
    setIsLoading(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [storesRes, analyticsRes, dbRes] = await Promise.all([
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
        }),
        supabase.from('merchants').select('id, name, shopify_domain, logo_url, contact_email, return_link, return_link_params'),
      ]);

      const storesData = await storesRes.json();
      const analyticsData = await analyticsRes.json();
      
      // Build DB config map by shopify_domain
      const dbConfigMap = new Map<string, MerchantConfig>();
      if (dbRes.data) {
        for (const row of dbRes.data) {
          dbConfigMap.set(row.shopify_domain, {
            id: row.id,
            logo_url: row.logo_url,
            contact_email: row.contact_email,
            return_link: row.return_link,
            return_link_params: row.return_link_params,
          });
        }
      }

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
          const dbConfig = dbConfigMap.get(domain);
          
          let status: 'active' | 'pending' | 'inactive' = 'inactive';
          if (totalCheckouts > 0) {
            status = 'active';
          } else {
            status = 'pending';
          }

          return {
            id: String(index + 1),
            name: dbConfig?.id ? formatStoreName(domain) : formatStoreName(domain),
            shopifyDomain: domain,
            totalOptIns: optIns,
            totalCheckouts: totalCheckouts,
            optInRate: optInRate,
            status: status,
            dbId: dbConfig?.id || undefined,
            logo_url: dbConfig?.logo_url || null,
            contact_email: dbConfig?.contact_email || null,
            return_link: dbConfig?.return_link || null,
            return_link_params: dbConfig?.return_link_params || null,
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

  const openEditDialog = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setEditForm({
      name: merchant.name,
      contact_email: merchant.contact_email || '',
      logo_url: merchant.logo_url || '',
      return_link: merchant.return_link || '',
      return_link_params: merchant.return_link_params || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingMerchant) return;
    setIsSaving(true);

    try {
      const upsertData = {
        name: editForm.name || formatStoreName(editingMerchant.shopifyDomain),
        shopify_domain: editingMerchant.shopifyDomain,
        contact_email: editForm.contact_email || null,
        logo_url: editForm.logo_url || null,
        return_link: editForm.return_link || null,
        return_link_params: editForm.return_link_params || null,
        status: editingMerchant.status,
      };

      if (editingMerchant.dbId) {
        const { error } = await supabase
          .from('merchants')
          .update(upsertData)
          .eq('id', editingMerchant.dbId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('merchants')
          .insert(upsertData);
        if (error) throw error;
      }

      toast.success('Merchant updated successfully');
      setEditingMerchant(null);
      fetchMerchants();
    } catch (error) {
      console.error('Error saving merchant:', error);
      toast.error('Failed to save merchant');
    } finally {
      setIsSaving(false);
    }
  };

  const totalMerchants = merchants.length;
  const activeMerchants = merchants.filter(m => m.status === 'active').length;
  const totalOptIns = merchants.reduce((acc, m) => acc + m.totalOptIns, 0);

  return (
    <div className="space-y-6">
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search merchants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-10"></TableHead>
              <TableHead>Store Name</TableHead>
              <TableHead>Shopify Domain</TableHead>
              <TableHead>Return Link</TableHead>
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
                  <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredMerchants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No merchants found
                </TableCell>
              </TableRow>
            ) : (
              filteredMerchants.map((merchant) => (
                <TableRow key={merchant.id} className="border-border">
                  <TableCell>
                    {merchant.logo_url ? (
                      <img
                        src={merchant.logo_url}
                        alt={merchant.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Store className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{merchant.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {merchant.shopifyDomain}
                  </TableCell>
                  <TableCell>
                    {merchant.return_link ? (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs max-w-[180px] truncate">
                          <ExternalLink className="h-3 w-3 mr-1 shrink-0" />
                          {new URL(merchant.return_link).hostname}
                        </Badge>
                        {merchant.return_link_params && (
                          <Badge variant="secondary" className="text-xs">
                            params
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
                        <DropdownMenuItem onClick={() => openEditDialog(merchant)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Config
                        </DropdownMenuItem>
                        {merchant.return_link && (
                          <DropdownMenuItem onClick={() => window.open(merchant.return_link!, '_blank')}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Return Portal
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Merchant Dialog */}
      <Dialog open={!!editingMerchant} onOpenChange={(open) => !open && setEditingMerchant(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Merchant Config</DialogTitle>
            <DialogDescription>
              Configure branding, contact info, and return portal settings for{' '}
              <span className="font-medium">{editingMerchant?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="editName">Display Name</Label>
              <Input
                id="editName"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="e.g., Universal Works"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="editEmail">Contact Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editForm.contact_email}
                onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                placeholder="e.g., returns@brand.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="editLogo">Logo URL</Label>
              <Input
                id="editLogo"
                value={editForm.logo_url}
                onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              {editForm.logo_url && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                  <img src={editForm.logo_url} alt="Preview" className="h-10 w-10 rounded object-cover" />
                  <span className="text-xs text-muted-foreground">Logo preview</span>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Return Portal Configuration</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="editReturnLink">Return Link (Base URL)</Label>
              <Input
                id="editReturnLink"
                value={editForm.return_link}
                onChange={(e) => setEditForm({ ...editForm, return_link: e.target.value })}
                placeholder="https://returns.brand.com/"
              />
              <p className="text-xs text-muted-foreground">
                The base URL of the return portal
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="editReturnParams">Pre-fill Query Parameters</Label>
              <Textarea
                id="editReturnParams"
                value={editForm.return_link_params}
                onChange={(e) => setEditForm({ ...editForm, return_link_params: e.target.value })}
                placeholder="?s=1&lang=&e={email}&o={order_number}"
                rows={2}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{'{email}'}</code> and{' '}
                <code className="bg-muted px-1 rounded">{'{order_number}'}</code> as placeholders.
                These will be dynamically replaced with the customer's data.
              </p>
            </div>

            {editForm.return_link && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium mb-1">Preview URL:</p>
                <p className="text-xs font-mono break-all text-muted-foreground">
                  {editForm.return_link}
                  {editForm.return_link_params
                    ?.replace('{email}', 'customer@example.com')
                    .replace('{order_number}', '1234')}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMerchant(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Merchants;
