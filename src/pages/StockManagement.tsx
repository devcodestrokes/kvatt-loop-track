import { useState, useEffect } from 'react';
import { Package, MapPin, AlertTriangle, Plus, RefreshCw, TrendingUp } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StockItem {
  id: string;
  merchant_id: string;
  merchant_name?: string;
  location: string;
  available: number;
  in_use: number;
  returned: number;
  damaged: number;
}

const StockManagement = () => {
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [newStock, setNewStock] = useState({
    merchant_id: '',
    location: '',
    available: 0,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch stock with merchant names
      const { data: stockResult, error: stockError } = await supabase
        .from('stock')
        .select(`
          *,
          merchants (name)
        `);

      if (stockError) throw stockError;

      const formattedStock = (stockResult || []).map((item: any) => ({
        ...item,
        merchant_name: item.merchants?.name || 'Unassigned',
      }));

      setStockData(formattedStock);

      // Fetch merchants
      const { data: merchantResult } = await supabase.from('merchants').select('id, name');
      setMerchants(merchantResult || []);
    } catch (error) {
      console.error('Error fetching stock:', error);
      toast.error('Failed to load stock data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddStock = async () => {
    if (!newStock.location) {
      toast.error('Please enter a location');
      return;
    }

    try {
      const { error } = await supabase.from('stock').insert({
        merchant_id: newStock.merchant_id || null,
        location: newStock.location,
        available: newStock.available,
      });

      if (error) throw error;

      toast.success('Stock location added');
      setIsAddingStock(false);
      setNewStock({ merchant_id: '', location: '', available: 0 });
      fetchData();
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error('Failed to add stock');
    }
  };

  const totalAvailable = stockData.reduce((acc, s) => acc + s.available, 0);
  const totalInUse = stockData.reduce((acc, s) => acc + s.in_use, 0);
  const totalDamaged = stockData.reduce((acc, s) => acc + s.damaged, 0);
  const lowStockLocations = stockData.filter(s => s.available < 50).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Management</h1>
          <p className="text-sm text-muted-foreground">
            Monitor packaging inventory across all locations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isAddingStock} onOpenChange={setIsAddingStock}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Stock Location</DialogTitle>
                <DialogDescription>
                  Add a new warehouse or stock location.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Location Name</Label>
                  <Input
                    value={newStock.location}
                    onChange={(e) => setNewStock({ ...newStock, location: e.target.value })}
                    placeholder="e.g., London Warehouse"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Merchant (Optional)</Label>
                  <Select
                    value={newStock.merchant_id}
                    onValueChange={(value) => setNewStock({ ...newStock, merchant_id: value })}
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
                  <Label>Initial Stock</Label>
                  <Input
                    type="number"
                    value={newStock.available}
                    onChange={(e) => setNewStock({ ...newStock, available: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingStock(false)}>Cancel</Button>
                <Button onClick={handleAddStock}>Add Location</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-semibold">{totalAvailable.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Use</p>
              <p className="text-2xl font-semibold">{totalInUse.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Damaged</p>
              <p className="text-2xl font-semibold">{totalDamaged}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Low Stock Locations</p>
              <p className="text-2xl font-semibold">{lowStockLocations}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Location</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">In Use</TableHead>
              <TableHead className="text-right">Returned</TableHead>
              <TableHead className="text-right">Damaged</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : stockData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No stock locations found. Add your first location above.
                </TableCell>
              </TableRow>
            ) : (
              stockData.map((item) => (
                <TableRow key={item.id} className="border-border">
                  <TableCell className="font-medium">{item.location}</TableCell>
                  <TableCell>{item.merchant_name}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={item.available < 50 ? 'text-destructive font-semibold' : ''}>
                      {item.available.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{item.in_use.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{item.returned.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{item.damaged}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {(item.available + item.in_use + item.returned + item.damaged).toLocaleString()}
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

export default StockManagement;
