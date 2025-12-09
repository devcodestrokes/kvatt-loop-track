import { useState } from 'react';
import { PackageCheck, Search, Truck, Calendar, Package } from 'lucide-react';
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

interface Shipment {
  id: string;
  labelId: string;
  groupId: string;
  merchant: string;
  orderId: string;
  shippedAt: string;
  carrier: string;
  status: 'processing' | 'shipped' | 'in_transit' | 'delivered';
  destination: string;
}

const mockShipments: Shipment[] = [
  { id: '1', labelId: 'LBL-A1B2C3', groupId: 'GRP-2024-001', merchant: 'EcoStore UK', orderId: '#1234', shippedAt: '2024-01-22 09:15', carrier: 'DPD', status: 'in_transit', destination: 'London, UK' },
  { id: '2', labelId: 'LBL-D4E5F6', groupId: 'GRP-2024-001', merchant: 'EcoStore UK', orderId: '#1235', shippedAt: '2024-01-22 10:30', carrier: 'Royal Mail', status: 'shipped', destination: 'Manchester, UK' },
  { id: '3', labelId: 'LBL-G7H8I9', groupId: 'GRP-2024-002', merchant: 'Green Fashion', orderId: '#4567', shippedAt: '2024-01-21 14:45', carrier: 'DPD', status: 'delivered', destination: 'Birmingham, UK' },
  { id: '4', labelId: 'LBL-J1K2L3', groupId: 'GRP-2024-002', merchant: 'Green Fashion', orderId: '#4568', shippedAt: '2024-01-21 16:00', carrier: 'Evri', status: 'delivered', destination: 'Leeds, UK' },
  { id: '5', labelId: 'LBL-M4N5O6', groupId: 'GRP-2024-003', merchant: 'Sustainable Home', orderId: '#7890', shippedAt: '2024-01-22 08:00', carrier: 'Royal Mail', status: 'processing', destination: 'Bristol, UK' },
];

const statusColors = {
  processing: 'bg-muted text-muted-foreground',
  shipped: 'bg-chart-total/10 text-chart-total',
  in_transit: 'bg-kvatt-brown/10 text-kvatt-brown',
  delivered: 'bg-primary/10 text-primary',
};

const Outbound = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredShipments = mockShipments.filter((shipment) => {
    const matchesSearch =
      shipment.labelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.merchant.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalShipments = mockShipments.length;
  const inTransit = mockShipments.filter(s => s.status === 'in_transit').length;
  const delivered = mockShipments.filter(s => s.status === 'delivered').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outbound Shipments</h1>
        <p className="text-sm text-muted-foreground">
          Track packages shipped from Mintsoft WMS to customers
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Shipments</p>
              <p className="text-2xl font-semibold">{totalShipments}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Transit</p>
              <p className="text-2xl font-semibold">{inTransit}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Delivered</p>
              <p className="text-2xl font-semibold">{delivered}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Label ID, Order ID, or Merchant..."
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
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Label ID</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Shipped At
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShipments.map((shipment) => (
              <TableRow key={shipment.id} className="border-border">
                <TableCell className="font-mono font-medium">{shipment.labelId}</TableCell>
                <TableCell className="font-mono">{shipment.orderId}</TableCell>
                <TableCell>{shipment.merchant}</TableCell>
                <TableCell>{shipment.carrier}</TableCell>
                <TableCell className="text-muted-foreground">{shipment.destination}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColors[shipment.status]}`}>
                    {shipment.status.replace('_', ' ')}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{shipment.shippedAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Outbound;
