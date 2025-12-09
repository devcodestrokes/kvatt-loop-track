import { useState } from 'react';
import { QrCode, Search, ExternalLink, MapPin, Clock, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

interface ScanEvent {
  id: string;
  labelId: string;
  groupId: string;
  merchant: string;
  scannedAt: string;
  location: string;
  eventType: 'customer_scan' | 'wms_outbound' | 'wms_inbound';
  status: 'in_transit' | 'delivered' | 'returned' | 'in_use';
}

const mockScans: ScanEvent[] = [
  { id: '1', labelId: 'LBL-A1B2C3', groupId: 'GRP-2024-001', merchant: 'EcoStore UK', scannedAt: '2024-01-22 14:32', location: 'London, UK', eventType: 'customer_scan', status: 'in_use' },
  { id: '2', labelId: 'LBL-D4E5F6', groupId: 'GRP-2024-001', merchant: 'EcoStore UK', scannedAt: '2024-01-22 12:15', location: 'Mintsoft WMS', eventType: 'wms_outbound', status: 'in_transit' },
  { id: '3', labelId: 'LBL-G7H8I9', groupId: 'GRP-2024-002', merchant: 'Green Fashion', scannedAt: '2024-01-22 10:45', location: 'Manchester, UK', eventType: 'customer_scan', status: 'in_use' },
  { id: '4', labelId: 'LBL-J1K2L3', groupId: 'GRP-2024-002', merchant: 'Green Fashion', scannedAt: '2024-01-21 16:20', location: 'Mintsoft WMS', eventType: 'wms_inbound', status: 'returned' },
  { id: '5', labelId: 'LBL-M4N5O6', groupId: 'GRP-2024-003', merchant: 'Sustainable Home', scannedAt: '2024-01-21 09:30', location: 'Birmingham, UK', eventType: 'customer_scan', status: 'in_use' },
];

const eventTypeLabels = {
  customer_scan: { label: 'Customer Scan', color: 'bg-primary/10 text-primary' },
  wms_outbound: { label: 'WMS Outbound', color: 'bg-chart-total/10 text-chart-total' },
  wms_inbound: { label: 'WMS Inbound', color: 'bg-kvatt-brown/10 text-kvatt-brown' },
};

const statusColors = {
  in_transit: 'bg-chart-total/10 text-chart-total',
  delivered: 'bg-primary/10 text-primary',
  returned: 'bg-kvatt-brown/10 text-kvatt-brown',
  in_use: 'bg-muted text-muted-foreground',
};

const QRTracking = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredScans = mockScans.filter((scan) => {
    const matchesSearch =
      scan.labelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scan.groupId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scan.merchant.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || scan.eventType === filterType;
    return matchesSearch && matchesFilter;
  });

  const totalScans = mockScans.length;
  const customerScans = mockScans.filter(s => s.eventType === 'customer_scan').length;
  const todayScans = mockScans.filter(s => s.scannedAt.startsWith('2024-01-22')).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">QR Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Monitor package scans and track customer interactions
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Scans</p>
              <p className="text-2xl font-semibold">{totalScans}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Customer Scans</p>
              <p className="text-2xl font-semibold">{customerScans}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Scans</p>
              <p className="text-2xl font-semibold">{todayScans}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Label ID, Group ID, or Merchant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="customer_scan">Customer Scans</SelectItem>
            <SelectItem value="wms_outbound">WMS Outbound</SelectItem>
            <SelectItem value="wms_inbound">WMS Inbound</SelectItem>
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
              <TableHead>Event Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Location
                </div>
              </TableHead>
              <TableHead>Scanned At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredScans.map((scan) => (
              <TableRow key={scan.id} className="border-border">
                <TableCell className="font-mono font-medium">{scan.labelId}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{scan.groupId}</TableCell>
                <TableCell>{scan.merchant}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${eventTypeLabels[scan.eventType].color}`}>
                    {eventTypeLabels[scan.eventType].label}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[scan.status]}`}>
                    {scan.status.replace('_', ' ')}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{scan.location}</TableCell>
                <TableCell className="text-muted-foreground">{scan.scannedAt}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
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

export default QRTracking;
