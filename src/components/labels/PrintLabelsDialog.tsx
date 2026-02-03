import { useState, useRef } from 'react';
import { Printer, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import PackLabel from './PackLabel';
import html2canvas from 'html2canvas';

interface Pack {
  id: string;
  label_id: string;
  status: string;
}

interface PrintLabelsDialogProps {
  packs: Pack[];
  disabled?: boolean;
}

const PrintLabelsDialog = ({ packs, disabled }: PrintLabelsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Filter only ungrouped/produced packs
  const availablePacks = packs.filter(p => p.status === 'produced');
  const displayPacks = availablePacks.slice(0, 50); // Limit preview to 50

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Pack Labels</title>
          <style>
            body { margin: 0; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
            .label { page-break-inside: avoid; }
            @media print {
              .grid { grid-template-columns: repeat(4, 1fr); }
            }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleDownloadPNG = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    
    try {
      const canvas = await html2canvas(printRef.current, { 
        backgroundColor: '#ffffff',
        scale: 2 
      });
      const link = document.createElement('a');
      link.download = `pack-labels-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Failed to generate image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={disabled || availablePacks.length === 0}>
          <Printer className="h-4 w-4" />
          Print Labels ({availablePacks.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Print Pack Labels</DialogTitle>
          <DialogDescription>
            Preview and print labels for {availablePacks.length} available packs
            {availablePacks.length > 50 && ` (showing first 50)`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          <Label>Label Size:</Label>
          <Select value={size} onValueChange={(v) => setSize(v as 'small' | 'medium' | 'large')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg p-4 bg-gray-50">
          <div 
            ref={printRef}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
          >
            {displayPacks.map((pack) => (
              <div key={pack.id} className="label">
                <PackLabel packId={pack.label_id} size={size} />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button variant="outline" onClick={handleDownloadPNG} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PNG
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintLabelsDialog;
