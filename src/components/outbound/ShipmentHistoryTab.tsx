import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Calendar, Store } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const ShipmentHistoryTab = () => {
  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['pack-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pack_shipments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (shipments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No shipments recorded yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Use the "Assign Packs" tab to create your first shipment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="data-table">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>Merchant</TableHead>
            <TableHead>Packs</TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Ship Date
              </div>
            </TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((s: any) => (
            <TableRow key={s.id} className="border-border">
              <TableCell>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{s.merchant_name}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-mono">
                  {s.pack_count} pack{s.pack_count !== 1 ? 's' : ''}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(s.shipped_date), 'dd MMM yyyy')}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                {s.notes || '—'}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(s.created_at), 'dd MMM yyyy HH:mm')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ShipmentHistoryTab;
