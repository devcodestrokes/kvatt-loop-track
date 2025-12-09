import { useState } from 'react';
import { Tag, Plus, Download, Search, Package, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface LabelGroup {
  id: string;
  groupId: string;
  labelCount: number;
  merchant: string;
  status: 'pending' | 'printed' | 'shipped' | 'active';
  createdAt: string;
}

const mockGroups: LabelGroup[] = [
  { id: '1', groupId: 'GRP-2024-001', labelCount: 500, merchant: 'EcoStore UK', status: 'active', createdAt: '2024-01-15' },
  { id: '2', groupId: 'GRP-2024-002', labelCount: 1000, merchant: 'Green Fashion', status: 'shipped', createdAt: '2024-01-18' },
  { id: '3', groupId: 'GRP-2024-003', labelCount: 250, merchant: 'Sustainable Home', status: 'printed', createdAt: '2024-01-20' },
  { id: '4', groupId: 'GRP-2024-004', labelCount: 750, merchant: 'Unassigned', status: 'pending', createdAt: '2024-01-22' },
];

const statusColors = {
  pending: 'bg-muted text-muted-foreground',
  printed: 'bg-chart-total/10 text-chart-total',
  shipped: 'bg-kvatt-brown/10 text-kvatt-brown',
  active: 'bg-primary/10 text-primary',
};

const Labels = () => {
  const [groups, setGroups] = useState<LabelGroup[]>(mockGroups);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [newLabelCount, setNewLabelCount] = useState('100');
  const [selectedMerchant, setSelectedMerchant] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredGroups = groups.filter(
    (group) =>
      group.groupId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.merchant.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGenerateLabels = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const newGroup: LabelGroup = {
        id: String(groups.length + 1),
        groupId: `GRP-2024-${String(groups.length + 1).padStart(3, '0')}`,
        labelCount: parseInt(newLabelCount),
        merchant: selectedMerchant || 'Unassigned',
        status: 'pending',
        createdAt: new Date().toISOString().split('T')[0],
      };
      
      setGroups([newGroup, ...groups]);
      setIsGenerating(false);
      setNewLabelCount('100');
      setSelectedMerchant('');
      toast.success(`Generated ${newLabelCount} labels`, {
        description: `Group ID: ${newGroup.groupId}`,
      });
    }, 1500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard');
  };

  const totalLabels = groups.reduce((acc, g) => acc + g.labelCount, 0);
  const activeLabels = groups.filter(g => g.status === 'active').reduce((acc, g) => acc + g.labelCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Label Generation</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage Label IDs and Group IDs for packaging
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Generate Labels
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate New Labels</DialogTitle>
              <DialogDescription>
                Create a new batch of unique Label IDs with a Group ID for tracking.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="labelCount">Number of Labels</Label>
                <Input
                  id="labelCount"
                  type="number"
                  value={newLabelCount}
                  onChange={(e) => setNewLabelCount(e.target.value)}
                  min="1"
                  max="10000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="merchant">Assign to Merchant (Optional)</Label>
                <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select merchant or leave unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eco-store">EcoStore UK</SelectItem>
                    <SelectItem value="green-fashion">Green Fashion</SelectItem>
                    <SelectItem value="sustainable-home">Sustainable Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleGenerateLabels} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate Labels'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Labels</p>
              <p className="text-2xl font-semibold">{totalLabels.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Labels</p>
              <p className="text-2xl font-semibold">{activeLabels.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Groups Created</p>
              <p className="text-2xl font-semibold">{groups.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Group ID or Merchant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Table */}
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Group ID</TableHead>
              <TableHead>Label Count</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.map((group) => (
              <TableRow key={group.id} className="border-border">
                <TableCell className="font-mono font-medium">{group.groupId}</TableCell>
                <TableCell>{group.labelCount.toLocaleString()}</TableCell>
                <TableCell>{group.merchant}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[group.status]}`}>
                    {group.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{group.createdAt}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(group.groupId)}
                  >
                    {copiedId === group.groupId ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Labels;
