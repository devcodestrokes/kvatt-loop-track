import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, FileText, Boxes, Download, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

interface CreateGroupTabProps {
  onGroupCreated: () => void;
}

interface ValidationResult {
  valid: string[];
  invalid: string[];
  alreadyGrouped: string[];
}

const generateGroupId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GRP-${timestamp}-${random}`;
};

export function CreateGroupTab({ onGroupCreated }: CreateGroupTabProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [groupQRCode, setGroupQRCode] = useState<string | null>(null);
  const [groupBarcode, setGroupBarcode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parsePackIds = (input: string): string[] => {
    return input
      .split(/[\n,\r\t]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  };

  const validatePackIds = async (packIds: string[]): Promise<ValidationResult> => {
    const uniqueIds = [...new Set(packIds)];
    
    // Check which IDs exist in the database
    const { data: existingLabels, error } = await supabase
      .from("labels")
      .select("label_id, group_id")
      .in("label_id", uniqueIds);

    if (error) throw error;

    const existingMap = new Map(existingLabels?.map((l) => [l.label_id, l.group_id]));

    const valid: string[] = [];
    const invalid: string[] = [];
    const alreadyGrouped: string[] = [];

    for (const id of uniqueIds) {
      if (!existingMap.has(id)) {
        invalid.push(id);
      } else if (existingMap.get(id)) {
        alreadyGrouped.push(id);
      } else {
        valid.push(id);
      }
    }

    return { valid, invalid, alreadyGrouped };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setManualInput(text);
    
    toast({
      title: "File loaded",
      description: `Loaded ${parsePackIds(text).length} pack IDs from file`,
    });
  };

  const handleValidate = async () => {
    const packIds = parsePackIds(manualInput);
    
    if (packIds.length === 0) {
      toast({
        title: "No pack IDs",
        description: "Please enter or upload pack IDs to validate",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setValidationResult(null);
    setCreatedGroupId(null);

    try {
      const result = await validatePackIds(packIds);
      setValidationResult(result);

      if (result.invalid.length > 0 || result.alreadyGrouped.length > 0) {
        toast({
          title: "Validation issues found",
          description: `${result.invalid.length} invalid, ${result.alreadyGrouped.length} already grouped`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "All pack IDs valid",
          description: `${result.valid.length} pack IDs ready for grouping`,
        });
      }
    } catch (error) {
      console.error("Validation error:", error);
      toast({
        title: "Validation failed",
        description: "Could not validate pack IDs",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!validationResult || validationResult.valid.length === 0) {
      toast({
        title: "No valid pack IDs",
        description: "Please validate pack IDs first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const groupId = generateGroupId();

      // Create the group record
      const { data: groupData, error: groupError } = await supabase
        .from("label_groups")
        .insert({
          group_id: groupId,
          label_count: validationResult.valid.length,
          status: "pending",
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Update all labels to link to this group
      const { error: updateError } = await supabase
        .from("labels")
        .update({ 
          group_id: groupData.id,
        })
        .in("label_id", validationResult.valid);

      if (updateError) throw updateError;

      // Generate QR and barcode for the group
      const qrDataUrl = await QRCode.toDataURL(groupId, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });

      const canvas = document.createElement("canvas");
      JsBarcode(canvas, groupId, {
        format: "CODE128",
        width: 3,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 10,
      });
      const barcodeDataUrl = canvas.toDataURL("image/png");

      setCreatedGroupId(groupId);
      setGroupQRCode(qrDataUrl);
      setGroupBarcode(barcodeDataUrl);
      setValidationResult(null);
      setManualInput("");
      onGroupCreated();

      toast({
        title: "Group created successfully",
        description: `Group ${groupId} created with ${validationResult.valid.length} packs`,
      });
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: "Failed to create group",
        description: "An error occurred while creating the group",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintGroupLabel = () => {
    if (!createdGroupId || !groupQRCode || !groupBarcode) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Group Label - ${createdGroupId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .label { 
              width: 4in; 
              height: 6in; 
              border: 2px solid #000; 
              padding: 20px; 
              text-align: center;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .qr { margin-bottom: 15px; }
            .qr img { width: 200px; height: 200px; }
            .barcode img { max-width: 250px; }
            .group-id { font-size: 18px; font-weight: bold; margin-top: 10px; font-family: monospace; }
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">GROUP LABEL</div>
            <div class="qr">
              <img src="${groupQRCode}" alt="QR Code" />
            </div>
            <div class="barcode">
              <img src="${groupBarcode}" alt="Barcode" />
            </div>
            <div class="group-id">${createdGroupId}</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Create Group ID
          </CardTitle>
          <CardDescription>
            Upload a CSV/text file with scanned pack IDs or enter them manually to create a group.
            A group represents a box of packs (~200) for simplified outbound logistics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV/TXT
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="packIds">Pack IDs (one per line or comma-separated)</Label>
            <Textarea
              id="packIds"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="KV-ABC123-XYZ&#10;KV-DEF456-UVW&#10;..."
              rows={8}
              className="font-mono text-sm"
              disabled={isProcessing}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleValidate} disabled={isProcessing || !manualInput.trim()}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Validate Pack IDs"
              )}
            </Button>
            {validationResult && validationResult.valid.length > 0 && (
              <Button onClick={handleCreateGroup} disabled={isProcessing}>
                Create Group ({validationResult.valid.length} packs)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Valid</span>
                </div>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {validationResult.valid.length}
                </p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Invalid</span>
                </div>
                <p className="text-2xl font-bold text-red-800 dark:text-red-200">
                  {validationResult.invalid.length}
                </p>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                  <Boxes className="h-5 w-5" />
                  <span className="font-medium">Already Grouped</span>
                </div>
                <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                  {validationResult.alreadyGrouped.length}
                </p>
              </div>
            </div>

            {validationResult.invalid.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-2">Invalid Pack IDs:</p>
                <div className="flex flex-wrap gap-1">
                  {validationResult.invalid.slice(0, 10).map((id) => (
                    <Badge key={id} variant="destructive" className="font-mono text-xs">
                      {id}
                    </Badge>
                  ))}
                  {validationResult.invalid.length > 10 && (
                    <Badge variant="outline">+{validationResult.invalid.length - 10} more</Badge>
                  )}
                </div>
              </div>
            )}

            {validationResult.alreadyGrouped.length > 0 && (
              <div>
                <p className="text-sm font-medium text-yellow-600 mb-2">Already Grouped:</p>
                <div className="flex flex-wrap gap-1">
                  {validationResult.alreadyGrouped.slice(0, 10).map((id) => (
                    <Badge key={id} variant="secondary" className="font-mono text-xs">
                      {id}
                    </Badge>
                  ))}
                  {validationResult.alreadyGrouped.length > 10 && (
                    <Badge variant="outline">+{validationResult.alreadyGrouped.length - 10} more</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {createdGroupId && groupQRCode && groupBarcode && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-300 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Group Created Successfully
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <img src={groupQRCode} alt="Group QR Code" className="w-40 h-40 mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">QR Code</p>
              </div>
              <div className="text-center">
                <img src={groupBarcode} alt="Group Barcode" className="max-w-[200px] mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Barcode</p>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold font-mono">{createdGroupId}</p>
                <p className="text-sm text-muted-foreground">Apply this label to the box</p>
              </div>
            </div>
            <Button onClick={handlePrintGroupLabel}>
              <FileText className="mr-2 h-4 w-4" />
              Print Group Label (PDF)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
