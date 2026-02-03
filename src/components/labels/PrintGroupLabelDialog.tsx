import { useState, useRef } from 'react';
import { Printer, Loader2, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import GroupLabel from './GroupLabel';
import html2canvas from 'html2canvas';

interface Group {
  id: string;
  group_id: string;
  label_count: number;
  created_at: string;
}

interface PrintGroupLabelDialogProps {
  group: Group;
}

const PrintGroupLabelDialog = ({ group }: PrintGroupLabelDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const printWindow = window.open('', '', 'width=400,height=500');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Group Label - ${group.group_id}</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              display: flex; 
              justify-content: center; 
              align-items: center;
              min-height: 100vh;
            }
            @media print {
              body { padding: 0; }
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

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    
    try {
      const canvas = await html2canvas(printRef.current, { 
        backgroundColor: '#ffffff',
        scale: 3
      });
      const link = document.createElement('a');
      link.download = `group-label-${group.group_id}.png`;
      link.href = canvas.toDataURL('image/png');
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
        <Button variant="ghost" size="sm">
          <FileText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Group Label</DialogTitle>
          <DialogDescription>
            Print or download this group label for the box
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <div ref={printRef}>
            <GroupLabel 
              groupId={group.group_id}
              packCount={group.label_count}
              createdAt={group.created_at}
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button variant="outline" onClick={handleDownloadPDF} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download
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

export default PrintGroupLabelDialog;
