import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  packagingType: string;
  manufacturer: string;
  labelStyle: string;
}

const PACKAGING_TYPES = [
  { value: "mailer-bag", label: "Mailer Bag" },
  { value: "box", label: "Box" },
  { value: "pouch", label: "Pouch" },
  { value: "envelope", label: "Envelope" },
  { value: "tote", label: "Tote Bag" },
];

const MANUFACTURERS = [
  { value: "kvatt-uk", label: "Kvatt UK" },
  { value: "kvatt-eu", label: "Kvatt EU" },
  { value: "partner-a", label: "Partner A" },
  { value: "partner-b", label: "Partner B" },
];

const LABEL_STYLES = [
  { value: "standard", label: "Standard (QR + Barcode)" },
  { value: "compact", label: "Compact (QR only)" },
  { value: "detailed", label: "Detailed (QR + Barcode + Info)" },
];

const generateUniqueLabelId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KV-${timestamp}-${random}`;
};

export function GenerateLabelsTab({ onLabelsGenerated }: GenerateLabelsTabProps) {
  const [quantity, setQuantity] = useState(10);
  const [packagingType, setPackagingType] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [labelStyle, setLabelStyle] = useState("standard");
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

    if (!packagingType) {
      toast({
        title: "Packaging type required",
        description: "Please select a packaging type",
        variant: "destructive",
      });
      return;
    }

    if (!manufacturer) {
      toast({
        title: "Manufacturer required",
        description: "Please select a manufacturer",
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
          packagingType,
          manufacturer,
          labelStyle,
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

    const totalImages = generatedLabels.length * 2; // QR + barcode per label
    
    const labelsHtml = generatedLabels
      .map(
        (label, index) => `
        <div class="label-card">
          <div class="qr-container">
            <img src="${label.qrDataUrl}" alt="QR Code" class="qr-img" data-img-index="${index * 2}" />
          </div>
          <div class="barcode-container">
            <img src="${label.barcodeDataUrl}" alt="Barcode" class="barcode-img" data-img-index="${index * 2 + 1}" />
          </div>
          <div class="label-id">${label.labelId}</div>
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
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px;
            }
            .loading-message {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 18px;
              color: #666;
              z-index: 1000;
            }
            .labels-container {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }
            .label-card {
              width: calc(50% - 10px);
              padding: 15px;
              border: 1px dashed #ccc;
              page-break-inside: avoid;
              text-align: center;
              background: white;
            }
            .qr-container {
              margin-bottom: 8px;
            }
            .qr-img {
              width: 120px;
              height: 120px;
              display: inline-block;
            }
            .barcode-container {
              margin-bottom: 8px;
            }
            .barcode-img {
              max-width: 180px;
              height: auto;
              display: inline-block;
            }
            .label-id {
              font-size: 11px;
              font-family: monospace;
              color: #333;
              word-break: break-all;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .loading-message { display: none; }
              .label-card {
                width: calc(50% - 5px);
                border: 1px dashed #999;
              }
            }
          </style>
        </head>
        <body>
          <div class="loading-message" id="loadingMsg">Loading images... Please wait</div>
          <div class="labels-container">
            ${labelsHtml}
          </div>
          <script>
            (function() {
              var images = document.querySelectorAll('img');
              var loaded = 0;
              var total = images.length;
              
              function checkAllLoaded() {
                loaded++;
                if (loaded >= total) {
                  document.getElementById('loadingMsg').style.display = 'none';
                  setTimeout(function() {
                    window.print();
                  }, 100);
                }
              }
              
              images.forEach(function(img) {
                if (img.complete) {
                  checkAllLoaded();
                } else {
                  img.onload = checkAllLoaded;
                  img.onerror = checkAllLoaded;
                }
              });
              
              // Fallback: print after 3 seconds even if images haven't loaded
              setTimeout(function() {
                document.getElementById('loadingMsg').style.display = 'none';
                window.print();
              }, 3000);
            })();
          </script>
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
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Number of Packagings</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={5000}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                placeholder="Number of packagings"
                disabled={isGenerating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="packagingType">Packaging Type</Label>
              <Select value={packagingType} onValueChange={setPackagingType} disabled={isGenerating}>
                <SelectTrigger id="packagingType">
                  <SelectValue placeholder="Select packaging type" />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGING_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Select value={manufacturer} onValueChange={setManufacturer} disabled={isGenerating}>
                <SelectTrigger id="manufacturer">
                  <SelectValue placeholder="Select manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {MANUFACTURERS.map((mfr) => (
                    <SelectItem key={mfr.value} value={mfr.value}>
                      {mfr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="labelStyle">Label Style</Label>
              <Select value={labelStyle} onValueChange={setLabelStyle} disabled={isGenerating}>
                <SelectTrigger id="labelStyle">
                  <SelectValue placeholder="Select label style" />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_STYLES.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full md:w-auto">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating... {progress}%
              </>
            ) : (
              "Create packs and generate labels"
            )}
          </Button>

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
