import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Printer, QrCode } from "lucide-react";
import kvattLogo from "@/assets/kvatt-logo.jpeg";
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
      width: 400,
      margin: 1,
      color: { dark: "#000000", light: "#e6e3db" },
    });
  };

  const generateBarcode = (labelId: string): string => {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, labelId, {
      format: "CODE128",
      width: 3,
      height: 100,
      displayValue: false,
      margin: 0,
      background: "#000000",
      lineColor: "#ffffff",
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

    // Generate labels based on selected style
    const labelsHtml = generatedLabels
      .map(
        (label) => `
          <div class="label-card">
            <div class="label-upper">
              <div class="label-left">
                <div class="heading-bold">Start your</div>
                <div class="heading-bold">return <img src="${kvattLogo}" alt="Kvatt" class="bird-logo" /></div>
                <div class="heading-italic">with one tap</div>
              </div>
              <div class="label-right">
                <div class="qr-label">QRCode</div>
                <div class="label-id-top">${label.labelId}</div>
                <img src="${label.qrDataUrl}" alt="QR Code" class="qr-img" />
              </div>
            </div>
            <div class="label-lower">
              <img src="${label.barcodeDataUrl}" alt="Barcode" class="barcode-img" />
              <div class="support-text">
                <div class="support-title">Call for support:</div>
                <div class="support-number">+44 (0) 75.49.88.48.50</div>
              </div>
            </div>
          </div>
        `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pack Labels - Kvatt</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; padding: 24px;
              background: #f5f5f5;
            }
            .labels-container {
              display: flex; flex-wrap: wrap; gap: 24px;
              justify-content: flex-start;
            }
            .label-card {
              width: 480px;
              aspect-ratio: 1200 / 754;
              background: #e6e3db;
              border-radius: 4px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              page-break-inside: avoid;
            }
            .label-upper {
              flex: 1;
              display: flex;
              align-items: center;
              padding: 28px 32px 16px 32px;
              gap: 16px;
            }
            .label-left { flex: 1; }
            .heading-bold {
              font-size: 38px;
              font-weight: 900;
              line-height: 1.05;
              color: #000;
              letter-spacing: -0.02em;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .bird-logo {
              width: 36px;
              height: 30px;
              object-fit: contain;
              display: inline-block;
            }
            .heading-italic {
              font-size: 36px;
              font-weight: 500;
              font-style: italic;
              line-height: 1.15;
              color: #000;
              letter-spacing: -0.02em;
              margin-top: 2px;
            }
            .label-right {
              display: flex;
              flex-direction: column;
              align-items: center;
              flex-shrink: 0;
            }
            .qr-label {
              font-size: 10px;
              color: #888;
              letter-spacing: 0.03em;
              margin-bottom: 2px;
            }
            .label-id-top {
              font-size: 11px;
              font-weight: 500;
              color: #333;
              letter-spacing: 0.02em;
              margin-bottom: 6px;
            }
            .qr-img { width: 160px; height: 160px; display: block; }
            .label-lower {
              background: #000;
              display: flex;
              align-items: center;
              padding: 16px 32px;
              gap: 24px;
            }
            .barcode-img { height: 56px; width: auto; }
            .support-text { color: #fff; font-size: 14px; line-height: 1.4; }
            .support-title { font-weight: 600; }
            .support-number { font-weight: 400; }
            @media print {
              body { margin: 0; padding: 8px; background: white; }
              .labels-container { gap: 16px; }
              .label-card { width: 100mm; }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">${labelsHtml}</div>
          <script>
            var images = document.querySelectorAll('img');
            var loaded = 0, total = images.length;
            if (total === 0) { setTimeout(function() { window.print(); }, 100); }
            function check() { loaded++; if (loaded >= total) setTimeout(function() { window.print(); }, 200); }
            images.forEach(function(img) { if (img.complete) check(); else { img.onload = check; img.onerror = check; } });
            setTimeout(function() { window.print(); }, 4000);
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
            <div ref={printRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedLabels.slice(0, 20).map((label) => (
                <div
                  key={label.id}
                  className="overflow-hidden flex flex-col"
                  style={{ aspectRatio: '1200 / 754', backgroundColor: '#e6e3db', borderRadius: '6px' }}
                >
                  {/* Upper section */}
                  <div className="flex-1 flex items-center px-5 pt-5 pb-3 gap-3">
                    <div className="flex-1">
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '24px', fontWeight: 900, lineHeight: 1.05, color: '#000', letterSpacing: '-0.02em' }}>
                        Start your
                      </div>
                      <div className="flex items-center gap-1" style={{ fontFamily: "'Inter', sans-serif", fontSize: '24px', fontWeight: 900, lineHeight: 1.05, color: '#000', letterSpacing: '-0.02em' }}>
                        return <img src={kvattLogo} alt="Kvatt" style={{ width: '22px', height: '19px', objectFit: 'contain', display: 'inline-block' }} />
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '22px', fontWeight: 500, fontStyle: 'italic', lineHeight: 1.15, color: '#000', letterSpacing: '-0.02em', marginTop: '2px' }}>
                        with one tap
                      </div>
                    </div>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span style={{ fontSize: '7px', color: '#888', letterSpacing: '0.03em' }}>QRCode</span>
                      <span style={{ fontSize: '7px', fontWeight: 500, color: '#333', marginBottom: '3px' }}>{label.labelId}</span>
                      <img src={label.qrDataUrl} alt="QR Code" className="block" style={{ width: '100px', height: '100px' }} />
                    </div>
                  </div>
                  {/* Lower black bar */}
                  <div className="flex items-center gap-3 px-4 py-2" style={{ backgroundColor: '#000' }}>
                    <img src={label.barcodeDataUrl} alt="Barcode" style={{ height: '32px', width: 'auto', maxWidth: '55%' }} />
                    <div style={{ color: '#fff', fontSize: '8px', lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>Call for support:</div>
                      <div>+44 (0) 75.49.88.48.50</div>
                    </div>
                  </div>
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
