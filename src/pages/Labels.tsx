import { useState, useEffect } from 'react';
import { Tag, Package, Search, ArrowUpDown, RotateCcw, Truck, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLabels } from '@/hooks/useLabels';
import GeneratePacksDialog from '@/components/labels/GeneratePacksDialog';
import CreateGroupDialog from '@/components/labels/CreateGroupDialog';
import PrintLabelsDialog from '@/components/labels/PrintLabelsDialog';
import PrintGroupLabelDialog from '@/components/labels/PrintGroupLabelDialog';
import AssignRetailerDialog from '@/components/labels/AssignRetailerDialog';
import InboundScanDialog from '@/components/labels/InboundScanDialog';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<string, string> = {
  produced: 'bg-muted text-muted-foreground',
  grouped: 'bg-chart-total/10 text-chart-total',
  shipped: 'bg-kvatt-brown/10 text-kvatt-brown',
  'in use': 'bg-primary/10 text-primary',
  returned: 'bg-green-500/10 text-green-700',
  pending: 'bg-muted text-muted-foreground',
  active: 'bg-primary/10 text-primary',
};

const Labels = () => {
  const {
    isLoading,
    packs,
    groups,
    fetchPacks,
    fetchGroups,
    generatePacks,
    createGroup,
    validatePackIds,
    assignGroupToRetailer,
    handlePackReturn,
  } = useLabels();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('packs');

  useEffect(() => {
    fetchPacks();
    fetchGroups();
  }, [fetchPacks, fetchGroups]);

  // Filter packs
  const filteredPacks = packs.filter(
    (pack) =>
      pack.label_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter groups
  const filteredGroups = groups.filter(
    (group) =>
      group.group_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const totalPacks = packs.length;
  const groupedPacks = packs.filter(p => p.status === 'grouped' || p.status === 'shipped').length;
  const returnedPacks = packs.filter(p => p.status === 'returned').length;
  const availablePacks = packs.filter(p => p.status === 'produced' || p.status === 'returned').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Packaging ID & Label System</h1>
          <p className="text-sm text-muted-foreground">
            Generate pack IDs, create groups, and track the full lifecycle
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GeneratePacksDialog onGenerate={generatePacks} isLoading={isLoading} />
          <CreateGroupDialog 
            onValidate={validatePackIds} 
            onCreate={createGroup}
            isLoading={isLoading} 
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Packs</p>
              <p className="text-2xl font-semibold">{totalPacks.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Groups Created</p>
              <p className="text-2xl font-semibold">{groups.length}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Shipped Packs</p>
              <p className="text-2xl font-semibold">{groupedPacks.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-700">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available for Reuse</p>
              <p className="text-2xl font-semibold">{availablePacks.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintLabelsDialog packs={packs} />
          <AssignRetailerDialog onAssign={assignGroupToRetailer} isLoading={isLoading} />
          <InboundScanDialog onReturn={handlePackReturn} isLoading={isLoading} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="packs" className="gap-2">
            <Tag className="h-4 w-4" />
            Pack IDs ({filteredPacks.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2">
            <Package className="h-4 w-4" />
            Groups ({filteredGroups.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="packs" className="mt-4">
          <div className="data-table">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>
                    <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1">
                      Pack ID <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredPacks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No packs found. Generate some pack IDs to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPacks.slice(0, 100).map((pack) => (
                    <TableRow key={pack.id} className="border-border">
                      <TableCell className="font-mono font-medium">{pack.label_id}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[pack.status] || 'bg-muted text-muted-foreground'}`}>
                          {pack.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {pack.group_id ? `Linked` : '—'}
                      </TableCell>
                      <TableCell>{pack.previous_uses}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(pack.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {filteredPacks.length > 100 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Showing first 100 of {filteredPacks.length} packs
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="mt-4">
          <div className="data-table">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Group ID</TableHead>
                  <TableHead>Pack Count</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No groups found. Create a group by uploading scanned pack IDs.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((group) => (
                    <TableRow key={group.id} className="border-border">
                      <TableCell className="font-mono font-medium">{group.group_id}</TableCell>
                      <TableCell>{group.label_count.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[group.status] || 'bg-muted text-muted-foreground'}`}>
                          {group.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(group.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <PrintGroupLabelDialog group={group} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Labels;
