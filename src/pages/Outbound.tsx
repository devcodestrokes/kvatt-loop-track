import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PackageCheck, Upload } from 'lucide-react';
import AssignPacksTab from '@/components/outbound/AssignPacksTab';
import ShipmentHistoryTab from '@/components/outbound/ShipmentHistoryTab';

const Outbound = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outbound</h1>
        <p className="text-sm text-muted-foreground">
          Assign packs to merchants and track outbound shipments
        </p>
      </div>

      <Tabs defaultValue="assign" className="w-full">
        <TabsList>
          <TabsTrigger value="assign" className="gap-2">
            <Upload className="h-4 w-4" />
            Assign Packs
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <PackageCheck className="h-4 w-4" />
            Shipment History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assign" className="mt-4">
          <AssignPacksTab />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ShipmentHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Outbound;
