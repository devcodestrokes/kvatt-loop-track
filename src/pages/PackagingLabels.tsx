import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateLabelsTab } from "@/components/packaging/GenerateLabelsTab";
import { CreateGroupTab } from "@/components/packaging/CreateGroupTab";
import { ScanTrackTab } from "@/components/packaging/ScanTrackTab";
import { GroupManagementTab } from "@/components/packaging/GroupManagementTab";
import { Package, QrCode, ScanLine, Boxes } from "lucide-react";

export default function PackagingLabels() {
  const [activeTab, setActiveTab] = useState("generate");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDataChange = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Packaging ID & Label Generation</h1>
        <p className="text-muted-foreground">
          Generate unique pack IDs, create groups, and track pack lifecycle through the supply chain.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Generate Labels
          </TabsTrigger>
          <TabsTrigger value="group" className="flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            Create Group
          </TabsTrigger>
          <TabsTrigger value="scan" className="flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            Scan & Track
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Manage Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <GenerateLabelsTab onLabelsGenerated={handleDataChange} />
        </TabsContent>

        <TabsContent value="group">
          <CreateGroupTab key={`group-${refreshKey}`} onGroupCreated={handleDataChange} />
        </TabsContent>

        <TabsContent value="scan">
          <ScanTrackTab key={`scan-${refreshKey}`} onStatusUpdated={handleDataChange} />
        </TabsContent>

        <TabsContent value="manage">
          <GroupManagementTab key={`manage-${refreshKey}`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
