import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, ScanLine, Package, Truck, RotateCcw, Store, 
  CheckCircle2, ArrowRight, History
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ScanTrackTabProps {
  onStatusUpdated: () => void;
}

type PackStatus = "available" | "grouped" | "shipped" | "in_use" | "returned";

interface PackInfo {
  id: string;
  label_id: string;
  status: string;
  group_id: string | null;
  merchant_id: string | null;
  previous_uses: number;
  current_order_id: string | null;
  group_info?: {
    group_id: string;
    status: string;
  } | null;
}

const STATUS_CONFIG: Record<PackStatus, { label: string; color: string; icon: React.ElementType }> = {
  available: { label: "Available", color: "bg-green-100 text-green-800", icon: Package },
  grouped: { label: "Grouped", color: "bg-blue-100 text-blue-800", icon: Package },
  shipped: { label: "Shipped to Retailer", color: "bg-purple-100 text-purple-800", icon: Truck },
  in_use: { label: "In Use", color: "bg-orange-100 text-orange-800", icon: Store },
  returned: { label: "Returned", color: "bg-gray-100 text-gray-800", icon: RotateCcw },
};

const MERCHANTS = [
  { id: "merchant-1", name: "TOAST" },
  { id: "merchant-2", name: "Retailer B" },
  { id: "merchant-3", name: "Retailer C" },
];

export function ScanTrackTab({ onStatusUpdated }: ScanTrackTabProps) {
  const [scanInput, setScanInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [packInfo, setPackInfo] = useState<PackInfo | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleScan = async () => {
    const packId = scanInput.trim();
    if (!packId) {
      toast({
        title: "Enter a pack ID",
        description: "Please scan or enter a pack ID",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setPackInfo(null);

    try {
      // First try to find it as a pack ID
      const { data: labelData, error: labelError } = await supabase
        .from("labels")
        .select("*, label_groups!labels_group_id_fkey(group_id, status)")
        .eq("label_id", packId)
        .single();

      if (labelData) {
        setPackInfo({
          ...labelData,
          group_info: labelData.label_groups,
        });
        return;
      }

      // Try to find it as a group ID
      const { data: groupData, error: groupError } = await supabase
        .from("label_groups")
        .select("*")
        .eq("group_id", packId)
        .single();

      if (groupData) {
        // Found a group, get all packs in this group
        const { data: packsInGroup } = await supabase
          .from("labels")
          .select("*")
          .eq("group_id", groupData.id);

        toast({
          title: "Group found",
          description: `Group ${packId} contains ${packsInGroup?.length || 0} packs`,
        });

        // Show the first pack as representative
        if (packsInGroup && packsInGroup.length > 0) {
          setPackInfo({
            ...packsInGroup[0],
            group_info: {
              group_id: groupData.group_id,
              status: groupData.status,
            },
          });
        }
        return;
      }

      toast({
        title: "Not found",
        description: "Pack ID or Group ID not found in system",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Scan error:", error);
      toast({
        title: "Scan failed",
        description: "Error looking up pack ID",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleStatusUpdate = async (newStatus: PackStatus) => {
    if (!packInfo) return;

    setIsUpdating(true);

    try {
      const updates: Record<string, any> = {
        status: newStatus,
      };

      // Handle merchant assignment for shipped status
      if (newStatus === "shipped" && selectedMerchant) {
        updates.merchant_id = selectedMerchant;
      }

      // Clear merchant on return
      if (newStatus === "returned") {
        updates.merchant_id = null;
        updates.current_order_id = null;
        updates.previous_uses = (packInfo.previous_uses || 0) + 1;
      }

      const { error } = await supabase
        .from("labels")
        .update(updates)
        .eq("id", packInfo.id);

      if (error) throw error;

      // Log the scan event
      await supabase.from("scan_events").insert({
        label_id: packInfo.id,
        event_type: newStatus,
        merchant_id: newStatus === "shipped" ? selectedMerchant : packInfo.merchant_id,
      });

      setPackInfo({
        ...packInfo,
        ...updates,
      });

      onStatusUpdated();

      toast({
        title: "Status updated",
        description: `Pack ${packInfo.label_id} is now ${STATUS_CONFIG[newStatus].label}`,
      });
    } catch (error) {
      console.error("Update error:", error);
      toast({
        title: "Update failed",
        description: "Could not update pack status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShipGroup = async () => {
    if (!packInfo?.group_info || !selectedMerchant) {
      toast({
        title: "Select a retailer",
        description: "Please select a retailer before shipping",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);

    try {
      // Get the group UUID from the pack's group_id
      const { data: groupData } = await supabase
        .from("label_groups")
        .select("id")
        .eq("group_id", packInfo.group_info.group_id)
        .single();

      if (!groupData) throw new Error("Group not found");

      // Update all packs in the group
      const { error: updateError } = await supabase
        .from("labels")
        .update({
          status: "shipped",
          merchant_id: selectedMerchant,
        })
        .eq("group_id", groupData.id);

      if (updateError) throw updateError;

      // Update group status
      await supabase
        .from("label_groups")
        .update({ status: "shipped" })
        .eq("id", groupData.id);

      onStatusUpdated();

      toast({
        title: "Group shipped",
        description: `All packs in group ${packInfo.group_info.group_id} assigned to ${
          MERCHANTS.find((m) => m.id === selectedMerchant)?.name
        }`,
      });

      setScanInput("");
      setPackInfo(null);
      setSelectedMerchant("");
    } catch (error) {
      console.error("Ship group error:", error);
      toast({
        title: "Failed to ship group",
        description: "Could not update group status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const currentStatus = packInfo?.status as PackStatus | undefined;
  const StatusIcon = currentStatus ? STATUS_CONFIG[currentStatus]?.icon : Package;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scan & Track
          </CardTitle>
          <CardDescription>
            Scan a pack ID or group ID to view status and update lifecycle. 
            Use at outbound to assign retailer, or at inbound to process returns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                placeholder="Scan or enter Pack ID / Group ID"
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
              />
            </div>
            <Button onClick={handleScan} disabled={isScanning}>
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ScanLine className="mr-2 h-4 w-4" />
                  Lookup
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {packInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StatusIcon className="h-5 w-5" />
              Pack Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Pack ID</p>
                <p className="font-mono font-medium">{packInfo.label_id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Status</p>
                <Badge className={currentStatus ? STATUS_CONFIG[currentStatus].color : ""}>
                  {currentStatus ? STATUS_CONFIG[currentStatus].label : packInfo.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Previous Uses</p>
                <p className="font-medium flex items-center gap-1">
                  <History className="h-4 w-4" />
                  {packInfo.previous_uses}
                </p>
              </div>
              {packInfo.group_info && (
                <div>
                  <p className="text-sm text-muted-foreground">Group</p>
                  <p className="font-mono text-sm">{packInfo.group_info.group_id}</p>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Update Status</h4>
              
              {packInfo.group_info && currentStatus === "grouped" && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mb-4">
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    This pack is part of group <strong>{packInfo.group_info.group_id}</strong>. 
                    Ship the entire group at once:
                  </p>
                  <div className="flex gap-2 items-center">
                    <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select retailer" />
                      </SelectTrigger>
                      <SelectContent>
                        {MERCHANTS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleShipGroup} disabled={isUpdating || !selectedMerchant}>
                      {isUpdating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Truck className="mr-2 h-4 w-4" />
                      )}
                      Ship Entire Group
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {currentStatus === "available" && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleStatusUpdate("grouped")}
                    disabled={isUpdating}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Mark as Grouped
                  </Button>
                )}

                {(currentStatus === "grouped" || currentStatus === "available") && (
                  <div className="flex gap-2 items-center">
                    <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select retailer" />
                      </SelectTrigger>
                      <SelectContent>
                        {MERCHANTS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      onClick={() => handleStatusUpdate("shipped")}
                      disabled={isUpdating || !selectedMerchant}
                    >
                      <Truck className="mr-2 h-4 w-4" />
                      Ship to Retailer
                    </Button>
                  </div>
                )}

                {currentStatus === "shipped" && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleStatusUpdate("in_use")}
                    disabled={isUpdating}
                  >
                    <Store className="mr-2 h-4 w-4" />
                    Mark In Use
                  </Button>
                )}

                {(currentStatus === "shipped" || currentStatus === "in_use") && (
                  <Button 
                    onClick={() => handleStatusUpdate("returned")}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Process Return
                  </Button>
                )}

                {currentStatus === "returned" && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleStatusUpdate("available")}
                    disabled={isUpdating}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark Available (Ready for Reuse)
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
