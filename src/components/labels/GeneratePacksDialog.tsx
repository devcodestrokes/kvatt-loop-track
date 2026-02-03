import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
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

interface GeneratePacksDialogProps {
  onGenerate: (count: number) => Promise<any>;
  isLoading: boolean;
}

const GeneratePacksDialog = ({ onGenerate, isLoading }: GeneratePacksDialogProps) => {
  const [count, setCount] = useState('100');
  const [open, setOpen] = useState(false);

  const handleGenerate = async () => {
    const numCount = parseInt(count);
    if (numCount > 0 && numCount <= 10000) {
      await onGenerate(numCount);
      setOpen(false);
      setCount('100');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Generate Pack IDs
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate New Pack IDs</DialogTitle>
          <DialogDescription>
            Create a batch of unique pack IDs with QR codes and barcodes for printing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="packCount">Number of Packs</Label>
            <Input
              id="packCount"
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              min="1"
              max="10000"
              placeholder="Enter number (1-10,000)"
            />
            <p className="text-xs text-muted-foreground">
              Each pack gets a unique ID encoded as QR code + Code128 barcode
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isLoading || !count || parseInt(count) <= 0}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Pack IDs'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GeneratePacksDialog;
