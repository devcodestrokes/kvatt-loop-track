import { useState } from 'react';
import { PackageCheck, Loader2, RotateCcw } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface InboundScanDialogProps {
  onReturn: (packId: string) => Promise<boolean>;
  isLoading: boolean;
}

const InboundScanDialog = ({ onReturn, isLoading }: InboundScanDialogProps) => {
  const [open, setOpen] = useState(false);
  const [packId, setPackId] = useState('');
  const [processedCount, setProcessedCount] = useState(0);
  const [lastProcessed, setLastProcessed] = useState<string | null>(null);

  const handleReturn = async () => {
    if (!packId.trim()) return;
    
    const success = await onReturn(packId.trim());
    if (success) {
      setLastProcessed(packId);
      setProcessedCount(prev => prev + 1);
      setPackId('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleReturn();
    }
  };

  const handleReset = () => {
    setOpen(false);
    setPackId('');
    setProcessedCount(0);
    setLastProcessed(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) handleReset();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <PackageCheck className="h-4 w-4" />
          Inbound Scan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inbound - Process Return</DialogTitle>
          <DialogDescription>
            Scan returned packs to reset their retailer assignment and mark them ready for reuse.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="packId">Pack ID (scan or type)</Label>
            <Input
              id="packId"
              value={packId}
              onChange={(e) => setPackId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="PK-XXXXXX-XXXX"
              className="font-mono text-lg"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Scan the pack barcode. Press Enter or click Process to continue.
            </p>
          </div>

          {processedCount > 0 && (
            <div className="p-4 rounded-lg bg-primary/10 text-center">
              <p className="text-3xl font-bold text-primary">{processedCount}</p>
              <p className="text-sm text-muted-foreground">Packs Processed</p>
            </div>
          )}

          {lastProcessed && (
            <Alert className="border-primary/50 bg-primary/5">
              <RotateCcw className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">Last Processed</AlertTitle>
              <AlertDescription className="font-mono">
                {lastProcessed} - Ready for next cycle
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>Done</Button>
          <Button onClick={handleReturn} disabled={isLoading || !packId.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Process Return'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InboundScanDialog;
