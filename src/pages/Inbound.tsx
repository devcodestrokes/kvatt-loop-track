import { useState } from 'react';
import { PackageX, Search, RotateCcw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Return {
  id: string;
  labelId: string;
  groupId: string;
  merchant: string;
  returnedAt: string;
  condition: 'excellent' | 'good' | 'fair' | 'damaged';
  status: 'pending' | 'received' | 'inspected' | 'ready_for_reuse';
  previousUses: number;
}

const mockReturns: Return[] = [
  { id: '1', labelId: 'LBL-X1Y2Z3', groupId: 'GRP-2024-001', merchant: 'EcoStore UK', returnedAt: '2024-01-22 11:30', condition: 'excellent', status: 'ready_for_reuse', previousUses: 3 },
  { id: '2', labelId: 'LBL-A9B8C7', groupId: 'GRP-2024-001', merchant: 'EcoStore UK', returnedAt: '2024-01-22 10:15', condition: 'good', status: 'inspected', previousUses: 5 },
  { id: '3', labelId: 'LBL-D6E5F4', groupId: 'GRP-2024-002', merchant: 'Green Fashion', returnedAt: '2024-01-21 16:45', condition: 'fair', status: 'received', previousUses: 8 },
  { id: '4', labelId: 'LBL-G3H2I1', groupId: 'GRP-2024-002', merchant: 'Green Fashion', returnedAt: '2024-01-21 14:20', condition: 'excellent', status: 'ready_for_reuse', previousUses: 2 },
  { id: '5', labelId: 'LBL-J0K9L8', groupId: 'GRP-2024-003', merchant: 'Sustainable Home', returnedAt: '2024-01-22 09:00', condition: 'damaged', status: 'pending', previousUses: 12 },
];

const statusColors = {
  pending: 'bg-muted text-muted-foreground',
  received: 'bg-chart-total/10 text-chart-total',
  inspected: 'bg-kvatt-brown/10 text-kvatt-brown',
  ready_for_reuse: 'bg-primary/10 text-primary',
};

const conditionColors = {
  excellent: 'bg-primary/10 text-primary',
  good: 'bg-chart-total/10 text-chart-total',
  fair: 'bg-kvatt-brown/10 text-kvatt-brown',
  damaged: 'bg-destructive/10 text-destructive',
};

const Inbound = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredReturns = mockReturns.filter((ret) => {
    const matchesSearch =
      ret.labelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.merchant.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ret.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalReturns = mockReturns.length;
  const readyForReuse = mockReturns.filter(r => r.status === 'ready_for_reuse').length;
  const pendingInspection = mockReturns.filter(r => r.status === 'pending' || r.status === 'received').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbound Returns</h1>
        <p className="text-sm text-muted-foreground">
          Track returned packages and manage reusability
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PackageX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Returns</p>
              <p className="text-2xl font-semibold">{totalReturns}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ready for Reuse</p>
              <p className="text-2xl font-semibold">{readyForReuse}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Inspection</p>
              <p className="text-2xl font-semibold">{pendingInspection}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Label ID or Merchant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="inspected">Inspected</SelectItem>
            <SelectItem value="ready_for_reuse">Ready for Reuse</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Label ID</TableHead>
              <TableHead>Group ID</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Previous Uses</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Returned At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReturns.map((ret) => (
              <TableRow key={ret.id} className="border-border">
                <TableCell className="font-mono font-medium">{ret.labelId}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{ret.groupId}</TableCell>
                <TableCell>{ret.merchant}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${conditionColors[ret.condition]}`}>
                    {ret.condition}
                  </span>
                </TableCell>
                <TableCell className="font-mono">{ret.previousUses}x</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[ret.status]}`}>
                    {ret.status.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{ret.returnedAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Inbound;
