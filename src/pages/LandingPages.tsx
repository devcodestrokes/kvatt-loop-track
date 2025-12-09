import { useState, useEffect } from 'react';
import { Globe, Plus, Edit, Eye, Trash2, ExternalLink, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LandingPage {
  id: string;
  merchant_id: string;
  merchant_name?: string;
  title: string;
  subtitle: string;
  primary_color: string;
  logo_url: string | null;
  instructions: string[];
  rewards_enabled: boolean;
  is_active: boolean;
  created_at: string;
}

const LandingPages = () => {
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPage, setEditingPage] = useState<LandingPage | null>(null);
  const [formData, setFormData] = useState({
    merchant_id: '',
    title: 'Return Your Package',
    subtitle: 'Help us create a circular economy',
    primary_color: '#fe655b',
    instructions: 'Scan the QR code\nDrop at nearest collection point\nEarn rewards!',
    rewards_enabled: false,
    is_active: true,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: pagesResult, error } = await supabase
        .from('landing_pages')
        .select(`
          *,
          merchants (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedPages = (pagesResult || []).map((p: any) => ({
        ...p,
        merchant_name: p.merchants?.name || 'Unknown',
        instructions: Array.isArray(p.instructions) ? p.instructions : JSON.parse(p.instructions || '[]'),
      }));

      setLandingPages(formattedPages);

      const { data: merchantResult } = await supabase.from('merchants').select('id, name');
      setMerchants(merchantResult || []);
    } catch (error) {
      console.error('Error fetching landing pages:', error);
      toast.error('Failed to load landing pages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!formData.merchant_id) {
      toast.error('Please select a merchant');
      return;
    }

    try {
      const instructions = formData.instructions.split('\n').filter(Boolean);
      
      const { error } = await supabase.from('landing_pages').insert({
        merchant_id: formData.merchant_id,
        title: formData.title,
        subtitle: formData.subtitle,
        primary_color: formData.primary_color,
        instructions,
        rewards_enabled: formData.rewards_enabled,
        is_active: formData.is_active,
      });

      if (error) throw error;

      toast.success('Landing page created');
      setIsCreating(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating landing page:', error);
      toast.error('Failed to create landing page');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('landing_pages')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(isActive ? 'Landing page activated' : 'Landing page deactivated');
      fetchData();
    } catch (error) {
      console.error('Error updating landing page:', error);
      toast.error('Failed to update landing page');
    }
  };

  const resetForm = () => {
    setFormData({
      merchant_id: '',
      title: 'Return Your Package',
      subtitle: 'Help us create a circular economy',
      primary_color: '#fe655b',
      instructions: 'Scan the QR code\nDrop at nearest collection point\nEarn rewards!',
      rewards_enabled: false,
      is_active: true,
    });
  };

  const activePages = landingPages.filter(p => p.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Landing Pages</h1>
          <p className="text-sm text-muted-foreground">
            Configure merchant landing pages for QR code scans
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Landing Page
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Landing Page</DialogTitle>
              <DialogDescription>
                Configure what customers see when they scan a QR code.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label>Merchant *</Label>
                <Select
                  value={formData.merchant_id}
                  onValueChange={(value) => setFormData({ ...formData, merchant_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Page Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Return Your Package"
                />
              </div>
              <div className="grid gap-2">
                <Label>Subtitle</Label>
                <Input
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Help us create a circular economy"
                />
              </div>
              <div className="grid gap-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    placeholder="#fe655b"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Instructions (one per line)</Label>
                <Textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  rows={4}
                  placeholder="Scan the QR code&#10;Drop at nearest collection point&#10;Earn rewards!"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Rewards</Label>
                  <p className="text-sm text-muted-foreground">Show reward incentives</p>
                </div>
                <Switch
                  checked={formData.rewards_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, rewards_enabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">Make page live</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create Page</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Pages</p>
              <p className="text-2xl font-semibold">{landingPages.length}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Pages</p>
              <p className="text-2xl font-semibold">{activePages}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Merchants with Pages</p>
              <p className="text-2xl font-semibold">{new Set(landingPages.map(p => p.merchant_id)).size}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Merchant</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Rewards</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : landingPages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No landing pages created yet. Create your first one above.
                </TableCell>
              </TableRow>
            ) : (
              landingPages.map((page) => (
                <TableRow key={page.id} className="border-border">
                  <TableCell className="font-medium">{page.merchant_name}</TableCell>
                  <TableCell>{page.title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full border" 
                        style={{ backgroundColor: page.primary_color }}
                      />
                      <span className="font-mono text-sm text-muted-foreground">
                        {page.primary_color}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      page.rewards_enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {page.rewards_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={page.is_active}
                      onCheckedChange={(checked) => handleToggleActive(page.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
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

export default LandingPages;
