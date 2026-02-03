import { useState, useEffect } from 'react';
import { Store, Loader2, ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { supabase } from '@/integrations/supabase/client';

interface Merchant {
  id: string;
  name: string;
}

interface AssignRetailerDialogProps {
  onAssign: (groupId: string, merchantId: string) => Promise<boolean>;
  isLoading: boolean;
}

const AssignRetailerDialog = ({ onAssign, isLoading }: AssignRetailerDialogProps) => {
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);

  useEffect(() => {
    if (open) {
      fetchMerchants();
    }
  }, [open]);

  const fetchMerchants = async () => {
    const { data } = await supabase
      .from('merchants')
      .select('id, name')
      .eq('status', 'active');
    setMerchants(data || []);
  };

  const handleAssign = async () => {
    if (!groupId || !merchantId) return;
    const success = await onAssign(groupId, merchantId);
    if (success) {
      setOpen(false);
      setGroupId('');
      setMerchantId('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ScanBarcode className="h-4 w-4" />
          Outbound Scan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Outbound - Assign to Retailer</DialogTitle>
          <DialogDescription>
            Scan a group ID at outbound to assign all packs in that group to a retailer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="groupId">Group ID (scan or type)</Label>
            <Input
              id="groupId"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="GRP-202501-XXXX"
              className="font-mono"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Scan the group barcode or enter the ID manually
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="merchant">Destination Retailer</Label>
            <Select value={merchantId} onValueChange={setMerchantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select retailer" />
              </SelectTrigger>
              <SelectContent>
                {merchants.map((merchant) => (
                  <SelectItem key={merchant.id} value={merchant.id}>
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      {merchant.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={isLoading || !groupId || !merchantId}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign to Retailer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignRetailerDialog;
