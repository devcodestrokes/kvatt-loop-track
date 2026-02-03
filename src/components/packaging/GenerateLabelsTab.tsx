import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

interface GenerateLabelsTabProps {
  onLabelsGenerated: () => void;
}

interface GeneratedLabel {
  id: string;
  labelId: string;
  qrDataUrl: string;
  barcodeDataUrl: string;
}

const generateUniqueLabelId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KV-${timestamp}-${random}`;
};

export function GenerateLabelsTab({ onLabelsGenerated }: GenerateLabelsTabProps) {
  const [quantity, setQuantity] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLabels, setGeneratedLabels] = useState<GeneratedLabel[]>([]);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const generateQRCode = async (labelId: string): Promise<string> => {
    return await QRCode.toDataURL(labelId, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  };

  const generateBarcode = (labelId: string): string => {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, labelId, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 12,
      margin: 5,
    });
    return canvas.toDataURL("image/png");
  };

  const handleGenerate = async () => {
    if (quantity < 1 || quantity > 5000) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a number between 1 and 5000",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setGeneratedLabels([]);

    try {
      const labels: GeneratedLabel[] = [];
      const batchSize = 50;
      
      for (let i = 0; i < quantity; i++) {
        const labelId = generateUniqueLabelId();
        const qrDataUrl = await generateQRCode(labelId);
        const barcodeDataUrl = generateBarcode(labelId);
        
        labels.push({
          id: crypto.randomUUID(),
          labelId,
          qrDataUrl,
          barcodeDataUrl,
        });

        if ((i + 1) % 10 === 0 || i === quantity - 1) {
          setProgress(Math.round(((i + 1) / quantity) * 100));
        }
      }

      // Insert labels into database in batches
      for (let i = 0; i < labels.length; i += batchSize) {
        const batch = labels.slice(i, i + batchSize);
        const { error } = await supabase.from("labels").insert(
          batch.map((label) => ({
            label_id: label.labelId,
            status: "available",
            previous_uses: 0,
          }))
        );

        if (error) {
          console.error("Error inserting labels:", error);
          throw error;
        }
      }

      setGeneratedLabels(labels);
      onLabelsGenerated();

      toast({
        title: "Labels generated successfully",
        description: `Generated ${quantity} unique pack labels`,
      });
    } catch (error) {
      console.error("Error generating labels:", error);
      toast({
        title: "Error generating labels",
        description: "Failed to generate labels. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const labelsHtml = generatedLabels
      .map(
        (label) => `
        <div style="display: inline-block; width: 48%; margin: 1%; padding: 10px; border: 1px dashed #ccc; page-break-inside: avoid;">
          <div style="text-align: center; margin-bottom: 5px;">
            <img src="${label.qrDataUrl}" alt="QR Code" style="width: 100px; height: 100px;" />
          </div>
          <div style="text-align: center; margin-bottom: 5px;">
            <img src="${label.barcodeDataUrl}" alt="Barcode" style="max-width: 150px;" />
          </div>
          <div style="text-align: center; font-size: 10px; font-family: monospace;">
            ${label.labelId}
          </div>
        </div>
      `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pack Labels</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    const csv = [
      "Label ID,QR Code URL,Barcode URL",
      ...generatedLabels.map((l) => `${l.labelId},"${l.qrDataUrl}","${l.barcodeDataUrl}"`),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pack-labels-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Generate Pack Labels
          </CardTitle>
          <CardDescription>
            Generate unique pack IDs with QR codes (for customers) and barcodes (for warehouse scanners).
            Both encode the same unique pack ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Number of Labels</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={5000}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-40"
                disabled={isGenerating}
              />
            </div>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating... {progress}%
                </>
              ) : (
                "Generate Labels"
              )}
            </Button>
          </div>

          {generatedLabels.length > 0 && (
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print Labels
              </Button>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {generatedLabels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Labels Preview ({generatedLabels.length})</CardTitle>
            <CardDescription>Preview of the first 20 generated labels</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={printRef} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {generatedLabels.slice(0, 20).map((label) => (
                <div
                  key={label.id}
                  className="border rounded-lg p-3 text-center bg-white"
                >
                  <img
                    src={label.qrDataUrl}
                    alt="QR Code"
                    className="mx-auto w-20 h-20 mb-2"
                  />
                  <img
                    src={label.barcodeDataUrl}
                    alt="Barcode"
                    className="mx-auto max-w-[120px] mb-1"
                  />
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {label.labelId}
                  </p>
                </div>
              ))}
            </div>
            {generatedLabels.length > 20 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Showing 20 of {generatedLabels.length} labels. Use Print or Export to access all.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
