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
}

const PACKAGING_TYPES = [
  { value: "M", label: "Mailer (M)" },
  { value: "B", label: "Box (B)" },
  { value: "P", label: "Pouch (P)" },
  { value: "T", label: "Tote (T)" },
  { value: "G", label: "Garment (G)" },
];

const PACK_SIZES = [
  { value: "1", label: "XS (1)" },
  { value: "2", label: "S (2)" },
  { value: "3", label: "M (3)" },
  { value: "4", label: "L (4)" },
  { value: "5", label: "XL (5)" },
];

const SUPPLIERS = [
  { value: "B", label: "LegoPlast Sàrl (B)" },
  { value: "R", label: "RePack (R)" },
  { value: "X", label: "Testing (X)" },
];

// Month encoding: lowercase letters skipping vowels (a,e,i,o,u)
const MONTH_CODES = ['b','c','d','f','g','h','j','k','l','m','n','p'];

// Year encoding: 1=2026, 2=2027 ... 9=2034, 0=2035, then b=2036, c=2037...
const encodeYear = (year: number): string => {
  const offset = year - 2026;
  if (offset < 0) return '1';
  if (offset <= 8) return String(offset + 1); // 1-9
  if (offset === 9) return '0'; // 2035
  // After 2035: b=2036, c=2037, etc. (skip vowels)
  const NO_VOWEL_CHARS = 'bcdfghjklmnpqrstvwxyz';
  const extOffset = offset - 10;
  return extOffset < NO_VOWEL_CHARS.length ? NO_VOWEL_CHARS[extOffset] : 'z';
};

// Serial chars: alphanumeric excluding vowels (must match DB function order)
const SERIAL_CHARS = '0123456789BCDFGHJKLMNPQRSTVWXYZ';
const SERIAL_BASE = 31;

// Convert a number to a 5-char serial string
const numberToSerial = (num: number): string => {
  let result = '';
  let temp = num;
  for (let i = 0; i < 5; i++) {
    result = SERIAL_CHARS[temp % SERIAL_BASE] + result;
    temp = Math.floor(temp / SERIAL_BASE);
  }
  return result;
};

// Convert a 5-char serial string to a number
const serialToNumber = (serial: string): number => {
  let num = 0;
  for (let i = 0; i < 5; i++) {
    num = num * SERIAL_BASE + SERIAL_CHARS.indexOf(serial[i]);
  }
  return num;
};

const getPrefix = (supplier: string, packType: string, size: string): { prefix: string; monthCode: string; yearCode: string } => {
  const now = new Date();
  const monthCode = MONTH_CODES[now.getMonth()];
  const yearCode = encodeYear(now.getFullYear());
  return {
    prefix: `K${supplier}${packType}${size}${monthCode}${yearCode}`,
    monthCode,
    yearCode,
  };
};

export function GenerateLabelsTab({ onLabelsGenerated }: GenerateLabelsTabProps) {
  const [quantity, setQuantity] = useState(10);
  const [packagingType, setPackagingType] = useState("");
  const [supplier, setSupplier] = useState("");
  const [packSize, setPackSize] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLabels, setGeneratedLabels] = useState<GeneratedLabel[]>([]);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const generateQRCode = async (labelId: string): Promise<string> => {
    return await QRCode.toDataURL(labelId, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#e6e3db" },
    });
  };

  const generateBarcode = (labelId: string): string => {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, labelId, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: false,
      margin: 4,
      background: "#ffffff",
      lineColor: "#000000",
    });
    return canvas.toDataURL("image/jpeg", 0.85);
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

    if (!supplier) {
      toast({
        title: "Supplier required",
        description: "Please select a supplier",
        variant: "destructive",
      });
      return;
    }

    if (!packSize) {
      toast({
        title: "Size required",
        description: "Please select a pack size",
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

      // Get prefix and fetch sequential serials from DB
      const { prefix, monthCode, yearCode } = getPrefix(supplier, packagingType, packSize);

      const { data: serialData, error: serialError } = await supabase.functions.invoke('get-next-pack-serials', {
        body: { prefix, month_code: monthCode, year_code: yearCode, count: quantity }
      });

      if (serialError || serialData?.error) {
        throw new Error(serialData?.error || serialError?.message || 'Failed to get serial sequence');
      }

      const startSerialNum = serialToNumber(serialData.start_serial);

      for (let i = 0; i < quantity; i++) {
        const serial = numberToSerial(startSerialNum + i);
        const labelId = `${prefix}${serial}`;
        const qrUrl = `https://kvatt.codestrokes.com/search-orders?packId=${encodeURIComponent(labelId)}`;
        const qrDataUrl = await generateQRCode(qrUrl);
        const barcodeDataUrl = generateBarcode(labelId);

        labels.push({
          id: crypto.randomUUID(),
          labelId,
          qrDataUrl,
          barcodeDataUrl,
          packagingType,
          manufacturer: supplier,
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

  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    const printWindow = window.open("", "_blank");
    if (!printWindow) { setIsPrinting(false); return; }

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
                <img src="${label.qrDataUrl}" alt="QR Code" class="qr-img" />
              </div>
            </div>
            <div class="label-lower">
              <div class="barcode-container">
                <img src="${label.barcodeDataUrl}" alt="Barcode" class="barcode-img" />
                <div class="barcode-label-id">${label.labelId}</div>
              </div>
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
              height: 62.7mm;
              display: flex;
              align-items: stretch;
              padding: 0;
              position: relative;
            }
            .label-left {
              width: 60%;
              display: flex;
              flex-direction: column;
              justify-content: center;
              padding: 4mm 0 4mm 4mm;
            }
            .heading-bold {
              font-size: 50px;
              font-weight: 700;
              line-height: 1.05;
              color: #000;
              letter-spacing: -0.02em;
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .bird-logo {
              width: 50px;
              height: 44px;
              object-fit: contain;
              display: inline-block;
            }
            .heading-italic {
              font-size: 41px;
              font-weight: 500;
              font-style: italic;
              line-height: 1.15;
              color: #000;
              letter-spacing: -0.02em;
              margin-top: 2px;
            }
            .label-right {
              width: 45%;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              padding: 2mm 2mm 1mm 0;
            }
            .qr-img { width: 100%; max-width: 70mm; max-height: 70mm; display: block; aspect-ratio: 1; }
            .label-lower {
              background: #000;
              display: flex;
              align-items: center;
              padding: 0 4mm 0 4mm;
              gap: 3mm;
              height: 19.3mm;
            }
            .barcode-container {
              background: #fff;
              border-radius: 1.5mm;
              padding: 0mm 1mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 62mm;
              height: 14.5mm;
              flex-shrink: 0;
            }
            .barcode-img { height: 9mm; width: 100%; max-width: 100%; }
            .barcode-label-id {
              font-size: 10px;
              font-weight: 700;
              color: #000;
              text-align: center;
              margin-top: 0.3mm;
              letter-spacing: 0.03em;
            }
            .support-text { color: #fff; font-size: 14px; line-height: 1.3; margin-left: 15px; text-align: left; white-space: nowrap; width: 37mm; }
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
            var printed = false;
            function doPrint() { if (!printed) { printed = true; window.print(); } }
            var images = document.querySelectorAll('img');
            var loaded = 0, total = images.length;
            if (total === 0) { setTimeout(doPrint, 100); }
            function check() { loaded++; if (loaded >= total) setTimeout(doPrint, 200); }
            images.forEach(function(img) { if (img.complete) check(); else { img.onload = check; img.onerror = check; } });
            setTimeout(doPrint, 4000);
          </script>
        </body>
      </html>
    `);
    // Reset printing state after a delay (print dialog is in new window)
    setTimeout(() => setIsPrinting(false), 2000);
  };

  const [isExportingCSV, setIsExportingCSV] = useState(false);

  const handleExportCSV = () => {
    setIsExportingCSV(true);
    try {
      const csv = [
        "Pack ID,Barcode,QR Code URL",
        ...generatedLabels.map((l) => `${l.labelId},${l.labelId},https://kvatt.codestrokes.com/search-orders?packId=${encodeURIComponent(l.labelId)}`),
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
    } finally {
      setTimeout(() => setIsExportingCSV(false), 1000);
    }
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

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const addLabelPage = (
    pdf: any,
    label: GeneratedLabel,
    isFirst: boolean,
    logoDataUrl: string | null,
  ) => {
    const W = 130, H = 82;
    if (!isFirst) pdf.addPage([H, W], "landscape");

    pdf.setFillColor(230, 227, 219);
    pdf.rect(0, 0, W, H, "F");

    const barH = 19.3;
    pdf.setFillColor(0, 0, 0);
    pdf.rect(0, H - barH, W, barH, "F");

    const upperH = H - barH;

    pdf.setFont("Inter", "bold");
    pdf.setFontSize(38);
    pdf.setTextColor(0, 0, 0);
    const textX = 4;
    const textCenterY = upperH / 2;
    pdf.text("Start your", textX, textCenterY - 6);
    pdf.text("return", textX, textCenterY + 6);

    if (logoDataUrl) {
      const logoW = 12, logoH2 = 10;
      const returnTextWidth = pdf.getTextWidth("return");
      pdf.addImage(logoDataUrl, "PNG", textX + returnTextWidth + 2, textCenterY + 6 - logoH2 + 1, logoW, logoH2);
    }

    pdf.setFont("Inter", "italic");
    pdf.setFontSize(31);
    pdf.text("with one tap", textX, textCenterY + 18);

    const qrAreaW = W * 0.393;
    const qrSize = Math.min(qrAreaW, upperH - 6);
    const qrX = W - qrAreaW / 2 - qrSize / 2 - 4;
    const qrY = (upperH - qrSize) / 2;
    pdf.addImage(label.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

    const containerW = 65, containerH = 14.5;
    const containerX = 4, containerY = H - barH + (barH - containerH) / 2;
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(containerX, containerY, containerW, containerH, 1, 1, "F");

    const barcodeW = 62, barcodeH2 = 11;
    pdf.addImage(label.barcodeDataUrl, "JPEG", containerX + (containerW - barcodeW) / 2, containerY + 0.5, barcodeW, barcodeH2);

    pdf.setFont("Inter", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);
    pdf.text(label.labelId, containerX + containerW / 2, containerY + barcodeH2 + 2.8, { align: "center" });

    pdf.setFont("Inter", "medium");
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text("Call for support:", W - 54, H - barH + 8, { align: "left" });
    pdf.setFont("Inter", "light");
    pdf.text("+44 (0) 75.49.88.48.50", W - 54, H - barH + 13, { align: "left" });
  };

  const handleDownloadPDF = async () => {
    const [{ default: jsPDF }, { PDFDocument }] = await Promise.all([
      import("jspdf"),
      import("pdf-lib"),
    ]);

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      let logoDataUrl: string | null = null;
      try {
        logoDataUrl = await imageToDataUrl(kvattLogo);
      } catch (e) {
        console.warn("Could not load logo for PDF:", e);
      }

      const [regular, light, medium, bold, italic] = await Promise.all([
        loadFontAsBase64('/fonts/Inter-Regular.ttf'),
        loadFontAsBase64('/fonts/Inter-Light.ttf'),
        loadFontAsBase64('/fonts/Inter-Medium.ttf'),
        loadFontAsBase64('/fonts/Inter-Bold.ttf'),
        loadFontAsBase64('/fonts/Inter-Italic.ttf'),
      ]);

      const W = 130, H = 82;
      const BATCH_SIZE = 100;
      const totalBatches = Math.ceil(generatedLabels.length / BATCH_SIZE);
      const mergedPdf = await PDFDocument.create();

      for (let b = 0; b < totalBatches; b++) {
        const batch = generatedLabels.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batchPdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [H, W] });

        batchPdf.addFileToVFS("Inter-Regular.ttf", regular);
        batchPdf.addFont("Inter-Regular.ttf", "Inter", "normal");
        batchPdf.addFileToVFS("Inter-Light.ttf", light);
        batchPdf.addFont("Inter-Light.ttf", "Inter", "light");
        batchPdf.addFileToVFS("Inter-Medium.ttf", medium);
        batchPdf.addFont("Inter-Medium.ttf", "Inter", "medium");
        batchPdf.addFileToVFS("Inter-Bold.ttf", bold);
        batchPdf.addFont("Inter-Bold.ttf", "Inter", "bold");
        batchPdf.addFileToVFS("Inter-Italic.ttf", italic);
        batchPdf.addFont("Inter-Italic.ttf", "Inter", "italic");

        for (let i = 0; i < batch.length; i++) {
          addLabelPage(batchPdf, batch[i], i === 0, logoDataUrl);
        }

        const batchBytes = batchPdf.output("arraybuffer") as ArrayBuffer;
        const batchDoc = await PDFDocument.load(batchBytes);
        const copiedPages = await mergedPdf.copyPages(batchDoc, batchDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));

        setDownloadProgress(Math.round(((b + 1) / totalBatches) * 90));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      setDownloadProgress(95);
      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });

      const dateStr = new Date().toISOString().split("T")[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pack-labels-${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress(100);
      toast({
        title: "PDF downloaded",
        description: `Downloaded ${generatedLabels.length} labels as a single PDF`,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "PDF download failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
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
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={supplier} onValueChange={setSupplier} disabled={isGenerating}>
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIERS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="packSize">Pack Size</Label>
              <Select value={packSize} onValueChange={setPackSize} disabled={isGenerating}>
                <SelectTrigger id="packSize">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {PACK_SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
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

          {generatedLabels.length > 0 && (() => {
            const anyExporting = isPrinting || isDownloading || isExportingCSV;
            return (
            <div className="flex gap-2 pt-4 border-t flex-wrap">
              <Button variant="outline" onClick={handlePrint} disabled={anyExporting}>
                {isPrinting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing Print...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Labels
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleDownloadPDF} disabled={anyExporting}>
                {isDownloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading... {downloadProgress}%
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Download PDF
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleExportCSV} disabled={anyExporting}>
                {isExportingCSV ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </>
                )}
              </Button>
            </div>
            );
          })()}
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
                    <div className="flex-1 flex flex-col justify-center" style={{ padding: '0 0 0 2cqi' }}>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11cqi', fontWeight: 700, lineHeight: 1.05, color: '#000', letterSpacing: '-0.02em' }}>
                        Start your
                      </div>
                      <div className="flex items-center" style={{ fontFamily: "'Inter', bold", fontSize: '11cqi', fontWeight: 700, lineHeight: 1.05, color: '#000', letterSpacing: '-0.02em', gap: '1cqi' }}>
                        return <img src={kvattLogo} alt="Kvatt" style={{ width: '11cqi', height: '9cqi', objectFit: 'contain', display: 'inline-block' }} />
                      </div>
                      <div style={{ fontFamily: "'Inter', bold", fontSize: '9.5cqi', fontWeight: 500, fontStyle: 'italic', lineHeight: 0.95, color: '#000', letterSpacing: '-0.03em', marginTop: '0.8cqi', marginLeft: '-3px' }}>
                        with one tap
                      </div>
                    </div>
                    {/* Right: QR only */}
                    <div className="flex flex-col items-center justify-start flex-shrink-0" style={{ padding: '2cqi 2cqi 0 0', width: '42cqi' }}>
                      <img src={label.qrDataUrl} alt="QR Code" className="block" style={{ width: '45cqi', height: '42cqi' }} />
                    </div>
                  </div>
                  {/* Lower black bar */}
                  <div className="flex items-center" style={{ backgroundColor: '#000', height: '24.4%', flexShrink: 0, padding: '0 5cqi 0 3cqi', gap: '2cqi' }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '1cqi', padding: '0.2cqi', width: '55%', height: '80%' }}>
                      <img src={label.barcodeDataUrl} alt="Barcode" style={{ height: '80%', width: '100%', flexShrink: 0 }} />
                      <div style={{ color: '#000', fontSize: '2.5cqi', lineHeight: 1, marginLeft: 'auto', marginRight: '4cqi', textAlign: 'center' as const, whiteSpace: 'nowrap', fontFamily: 'Inter, bold', fontWeight: 700 }}>
                        {label.labelId}
                      </div>
                    </div>
                    <div style={{ color: '#fff', fontSize: '2.8cqi', lineHeight: 1.3, marginLeft: 'auto', marginRight: '6cqi', textAlign: 'left' as const, whiteSpace: 'nowrap' }}>
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
