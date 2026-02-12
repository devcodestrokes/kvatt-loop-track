import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Printer, QrCode, FileDown } from "lucide-react";
import kvattLogo from "@/assets/kvatt-bird-logo.png";
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
          <title></title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              width: 130mm;
              height: 82mm;
              margin: 0;
              padding: 0;
              background: none;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: 130mm 82mm;
              margin: 0;
            }
            body { 
              font-family: 'Inter', sans-serif;
            }
            .labels-container {
              margin: 0; padding: 0;
            }
            .label-card {
              width: 130mm;
              height: 82mm;
              background: #e6e3db;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              page-break-after: always;
              margin: 0;
              padding: 0;
            }
            .label-upper {
              flex: 1;
              display: flex;
              align-items: stretch;
              padding: 0;
              position: relative;
            }
            .label-left { 
              flex: 1; 
              display: flex;
              flex-direction: column;
              justify-content: center;
              padding: 6mm 0 4mm 8mm;
            }
            .heading-bold {
              font-size: 32px;
              font-weight: 900;
              line-height: 1.05;
              color: #000;
              letter-spacing: -0.02em;
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .bird-logo {
              width: 40px;
              height: 34px;
              object-fit: contain;
              display: inline-block;
            }
            .heading-italic {
              font-size: 30px;
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
              padding: 3mm 6mm 4mm 0;
            }
            .label-id-top {
              font-size: 9px;
              font-weight: 500;
              color: #333;
              letter-spacing: 0.02em;
              margin-bottom: 2mm;
              text-align: center;
            }
            .qr-img { width: 36mm; height: 36mm; display: block; }
            .label-lower {
              background: #000;
              display: flex;
              align-items: center;
              padding: 2.5mm 6mm 2.5mm 8mm;
              gap: 4mm;
              height: 20mm;
            }
            .barcode-img { height: 16mm; width: auto; max-width: 55%; flex-shrink: 0; }
            .support-text { color: #fff; font-size: 12px; line-height: 1.3; margin-left: auto; text-align: right; white-space: nowrap; }
            .support-title { font-weight: 600; }
            .support-number { font-weight: 400; }
            @media print {
              html, body { margin: 0 !important; padding: 0 !important; background: none !important; }
              .label-card { page-break-after: always; break-after: page; }
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

  // Convert an image URL/import to a base64 data URL
  const imageToDataUrl = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No canvas context"));
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = src;
    });
  };

  const loadFontAsBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import("jspdf");

    // Pre-convert logo to data URL so jsPDF can embed it
    let logoDataUrl: string | null = null;
    try {
      logoDataUrl = await imageToDataUrl(kvattLogo);
    } catch (e) {
      console.warn("Could not load logo for PDF:", e);
    }

    // Load Inter font files
    const [interRegular, interBold, interItalic] = await Promise.all([
      loadFontAsBase64('/fonts/Inter-Regular.ttf'),
      loadFontAsBase64('/fonts/Inter-Bold.ttf'),
      loadFontAsBase64('/fonts/Inter-Italic.ttf'),
    ]);
    
    // Label dimensions in mm
    const W = 130, H = 82;
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [H, W] });

    // Register Inter fonts
    pdf.addFileToVFS("Inter-Regular.ttf", interRegular);
    pdf.addFont("Inter-Regular.ttf", "Inter", "normal");
    pdf.addFileToVFS("Inter-Bold.ttf", interBold);
    pdf.addFont("Inter-Bold.ttf", "Inter", "bold");
    pdf.addFileToVFS("Inter-Italic.ttf", interItalic);
    pdf.addFont("Inter-Italic.ttf", "Inter", "italic");

    for (let i = 0; i < generatedLabels.length; i++) {
      const label = generatedLabels[i];
      if (i > 0) pdf.addPage([H, W], "landscape");

      // Stone background
      pdf.setFillColor(230, 227, 219);
      pdf.rect(0, 0, W, H, "F");

      // Black bottom bar (bottom 20mm)
      const barH = 20;
      pdf.setFillColor(0, 0, 0);
      pdf.rect(0, H - barH, W, barH, "F");

      // Heading text
      pdf.setFont("Inter", "bold");
      pdf.setFontSize(34);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Start your", 8, 20);
      pdf.text("return", 8, 32);

      // Bird logo next to "return"
      if (logoDataUrl) {
        const logoW = 12, logoH = 10;
        // Position logo right after "return" text
        const returnTextWidth = pdf.getTextWidth("return");
        pdf.addImage(logoDataUrl, "PNG", 8 + returnTextWidth + 2, 32 - logoH + 1, logoW, logoH);
      }
      
      pdf.setFont("Inter", "italic");
      pdf.setFontSize(28);
      pdf.text("with one tap", 8, 44);

      // Label ID top-right
      pdf.setFont("Inter", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      pdf.text(label.labelId, W - 15, 5, { align: "right" });

      // QR Code (right side)
      const qrSize = 52;
      pdf.addImage(label.qrDataUrl, "PNG", W - 4 - qrSize, 6, qrSize, qrSize);

      // Barcode in black bar
      const barcodeW = 55, barcodeH = 14;
      pdf.addImage(label.barcodeDataUrl, "PNG", 8, H - barH + (barH - barcodeH) / 2, barcodeW, barcodeH);

      // Support text
      pdf.setFont("Inter", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Call for support:", W - 19, H - barH + 8, { align: "right" });
      pdf.setFont("Inter", "normal");
      pdf.text("+44 (0) 75.49.88.48.50", W - 6, H - barH + 14, { align: "right" });
    }

    pdf.save(`pack-labels-${new Date().toISOString().split("T")[0]}.pdf`);
    
    toast({
      title: "PDF downloaded",
      description: `Downloaded ${generatedLabels.length} labels as PDF`,
    });
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
            <div className="flex gap-2 pt-4 border-t flex-wrap">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print Labels
              </Button>
              <Button variant="outline" onClick={handleDownloadPDF}>
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF
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
             <div ref={printRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {generatedLabels.slice(0, 20).map((label) => (
                <div
                  key={label.id}
                  className="overflow-hidden flex flex-col w-full"
                  style={{ aspectRatio: '130 / 82', backgroundColor: '#e6e3db', borderRadius: '6px', containerType: 'inline-size' as any }}
                >
                  {/* Upper section */}
                  <div className="flex items-center" style={{ flex: '1 1 0', position: 'relative' }}>
                    {/* Left text - vertically centered */}
                    <div className="flex-1 flex flex-col justify-center" style={{ padding: '0 0 0 6cqi' }}>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '6.5cqi', fontWeight: 900, lineHeight: 1.05, color: '#000', letterSpacing: '-0.02em' }}>
                        Start your
                      </div>
                      <div className="flex items-center" style={{ fontFamily: "'Inter', sans-serif", fontSize: '6.5cqi', fontWeight: 900, lineHeight: 1.05, color: '#000', letterSpacing: '-0.02em', gap: '1cqi' }}>
                        return <img src={kvattLogo} alt="Kvatt" style={{ width: '7cqi', height: '5.5cqi', objectFit: 'contain', display: 'inline-block' }} />
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '5.5cqi', fontWeight: 500, fontStyle: 'italic', lineHeight: 1.15, color: '#000', letterSpacing: '-0.02em', marginTop: '0.8cqi' }}>
                        with one tap
                      </div>
                    </div>
                    {/* Right: label ID + QR - vertically centered */}
                    <div className="flex flex-col items-center justify-start flex-shrink-0" style={{ padding: '2cqi 4cqi 2cqi 0', width: '38cqi' }}>
                      <span style={{ fontSize: '1.5cqi', fontWeight: 500, color: '#555', marginBottom: '0.8cqi', textAlign: 'center', whiteSpace: 'nowrap' }}>{label.labelId}</span>
                      <img src={label.qrDataUrl} alt="QR Code" className="block" style={{ width: '28cqi', height: '28cqi' }} />
                    </div>
                  </div>
                  {/* Lower black bar */}
                  <div className="flex items-center" style={{ backgroundColor: '#000', height: '24.4%', flexShrink: 0, padding: '0 4cqi 0 5cqi', gap: '2cqi' }}>
                    <img src={label.barcodeDataUrl} alt="Barcode" style={{ height: '60%', width: 'auto', maxWidth: '48%', flexShrink: 0 }} />
                    <div style={{ color: '#fff', fontSize: '2.8cqi', lineHeight: 1.3, marginLeft: 'auto', textAlign: 'right' as const, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700 }}>Call for support:</div>
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
