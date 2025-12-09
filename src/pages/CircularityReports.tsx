import { useState, useEffect } from 'react';
import { Leaf, Recycle, TrendingUp, Download, Calendar, Factory, Droplets } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CircularityReport {
  id: string;
  merchant_id: string;
  merchant_name?: string;
  period_start: string;
  period_end: string;
  total_packages: number;
  packages_reused: number;
  average_reuses: number;
  co2_saved_kg: number;
  plastic_saved_kg: number;
  circularity_score: number;
  created_at: string;
}

const CircularityReports = () => {
  const [reports, setReports] = useState<CircularityReport[]>([]);
  const [merchants, setMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('circularity_reports')
        .select(`
          *,
          merchants (name)
        `)
        .order('period_end', { ascending: false });

      if (selectedMerchant !== 'all') {
        query = query.eq('merchant_id', selectedMerchant);
      }

      const { data: reportsResult, error } = await query;
      if (error) throw error;

      const formattedReports = (reportsResult || []).map((r: any) => ({
        ...r,
        merchant_name: r.merchants?.name || 'All Merchants',
      }));

      setReports(formattedReports);

      const { data: merchantResult } = await supabase.from('merchants').select('id, name');
      setMerchants(merchantResult || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMerchant]);

  // Aggregate totals
  const totalCO2Saved = reports.reduce((acc, r) => acc + Number(r.co2_saved_kg), 0);
  const totalPlasticSaved = reports.reduce((acc, r) => acc + Number(r.plastic_saved_kg), 0);
  const totalPackagesReused = reports.reduce((acc, r) => acc + r.packages_reused, 0);
  const avgCircularityScore = reports.length > 0 
    ? reports.reduce((acc, r) => acc + Number(r.circularity_score), 0) / reports.length 
    : 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-primary/10 text-primary';
    if (score >= 60) return 'bg-chart-total/10 text-chart-total';
    if (score >= 40) return 'bg-kvatt-brown/10 text-kvatt-brown';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Circularity Reports</h1>
          <p className="text-sm text-muted-foreground">
            Track environmental impact and sustainability metrics
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Environmental Impact Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="metric-card bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CO₂ Saved</p>
              <p className="text-2xl font-bold text-primary">{totalCO2Saved.toFixed(1)} kg</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chart-total/10 text-chart-total">
              <Droplets className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plastic Saved</p>
              <p className="text-2xl font-bold">{totalPlasticSaved.toFixed(1)} kg</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kvatt-brown/10 text-kvatt-brown">
              <Recycle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Packages Reused</p>
              <p className="text-2xl font-bold">{totalPackagesReused.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Circularity Score</p>
              <p className="text-2xl font-bold">{avgCircularityScore.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <div className="flex items-center gap-4">
          <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by merchant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Merchants</SelectItem>
              {merchants.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Merchant</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Period
                </div>
              </TableHead>
              <TableHead className="text-right">Total Packages</TableHead>
              <TableHead className="text-right">Reused</TableHead>
              <TableHead className="text-right">Avg Reuses</TableHead>
              <TableHead className="text-right">CO₂ Saved</TableHead>
              <TableHead className="text-right">Plastic Saved</TableHead>
              <TableHead className="text-center">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No circularity reports found.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.id} className="border-border">
                  <TableCell className="font-medium">{report.merchant_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(report.period_start), 'MMM d')} - {format(new Date(report.period_end), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right font-mono">{report.total_packages.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{report.packages_reused.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{Number(report.average_reuses).toFixed(1)}x</TableCell>
                  <TableCell className="text-right font-mono text-primary">{Number(report.co2_saved_kg).toFixed(1)} kg</TableCell>
                  <TableCell className="text-right font-mono">{Number(report.plastic_saved_kg).toFixed(1)} kg</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getScoreColor(Number(report.circularity_score))}`}>
                      {Number(report.circularity_score).toFixed(0)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CircularityReports;
