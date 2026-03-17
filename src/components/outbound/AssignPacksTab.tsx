import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Upload, CalendarIcon, Package, AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AssignPacksTab = () => {
  const [packIds, setPackIds] = useState<string[]>([]);
  const [rawInput, setRawInput] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [shippedDate, setShippedDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Fetch merchants
  const { data: merchants = [] } = useQuery({
    queryKey: ['merchants-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, name, logo_url, shopify_domain')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Parse pack IDs from CSV or text input
  const parsePackIds = useCallback((text: string) => {
    // Support CSV file content or comma/newline separated
    const lines = text.split(/[\n\r]+/).filter(Boolean);
    const ids: string[] = [];

    for (const line of lines) {
      // Split by comma and handle CSV with headers
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      for (const part of parts) {
        // Match pack ID pattern (starts with K)
        if (part && /^K[A-Z0-9]/i.test(part)) {
          ids.push(part);
        }
      }
    }

    // Deduplicate
    return [...new Set(ids)];
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parsePackIds(text);
      setPackIds(parsed);
      setRawInput(parsed.join('\n'));
      toast.success(`Parsed ${parsed.length} pack IDs from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTextInput = (text: string) => {
    setRawInput(text);
    const parsed = parsePackIds(text);
    setPackIds(parsed);
  };

  const removePack = (id: string) => {
    const updated = packIds.filter(p => p !== id);
    setPackIds(updated);
    setRawInput(updated.join('\n'));
  };

  const handleAssign = async () => {
    if (packIds.length === 0) {
      toast.error('Please add pack IDs');
      return;
    }
    if (!merchantId) {
      toast.error('Please select a merchant');
      return;
    }
    if (!shippedDate) {
      toast.error('Please select a shipment date');
      return;
    }

    setIsAssigning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('assign-packs', {
        body: {
          pack_ids: packIds,
          merchant_id: merchantId,
          shipped_date: format(shippedDate, 'yyyy-MM-dd'),
          notes: notes || undefined,
        },
      });

      if (error) throw error;

      setResult(data);

      if (data.assigned > 0) {
        toast.success(`${data.assigned} packs assigned to ${data.merchant_name}`);
        // Reset form
        setPackIds([]);
        setRawInput('');
        setNotes('');
      } else {
        toast.warning('No packs were assigned. Check the results below.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign packs');
    } finally {
      setIsAssigning(false);
    }
  };

  const selectedMerchant = merchants.find(m => m.id === merchantId);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Left: Input area */}
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pack IDs</CardTitle>
            <CardDescription>Upload a CSV or paste pack IDs to assign to a merchant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CSV Upload */}
            <div>
              <label
                htmlFor="csv-upload"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
              >
                <Upload className="h-5 w-5" />
                <span>Drop CSV file or click to upload</span>
              </label>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Text input */}
            <div>
              <Textarea
                placeholder="Or paste pack IDs here (one per line, or comma-separated)&#10;e.g. KB13B100001&#10;KB13B100002&#10;KB13B100003"
                value={rawInput}
                onChange={(e) => handleTextInput(e.target.value)}
                className="min-h-[140px] font-mono text-sm"
              />
            </div>

            {/* Pack ID preview */}
            {packIds.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {packIds.length} pack{packIds.length !== 1 ? 's' : ''} ready
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto">
                  {packIds.slice(0, 50).map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1 font-mono text-xs">
                      {id}
                      <button onClick={() => removePack(id)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {packIds.length > 50 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      +{packIds.length - 50} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Card className={result.assigned > 0 ? 'border-primary/30' : 'border-destructive/30'}>
            <CardContent className="pt-5 space-y-3">
              {result.assigned > 0 && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">{result.assigned} packs assigned to {result.merchant_name}</span>
                </div>
              )}
              {result.not_found?.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{result.not_found.length} pack(s) not found</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {result.not_found.map((id: string) => (
                      <Badge key={id} variant="destructive" className="font-mono text-xs">{id}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {result.already_assigned?.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">{result.already_assigned.length} pack(s) already assigned to another merchant</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: Assignment config */}
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Shipment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Merchant selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Merchant / Retailer</label>
              <Select value={merchantId} onValueChange={setMerchantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select merchant" />
                </SelectTrigger>
                <SelectContent>
                  {merchants.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        {m.logo_url && (
                          <img src={m.logo_url} alt="" className="h-5 w-5 rounded object-contain" />
                        )}
                        <span>{m.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected merchant info */}
            {selectedMerchant && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  {selectedMerchant.logo_url && (
                    <img src={selectedMerchant.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{selectedMerchant.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedMerchant.shopify_domain}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Date picker */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Shipment Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !shippedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {shippedDate ? format(shippedDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={shippedDate}
                    onSelect={setShippedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="e.g. Batch #42, PO reference..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {/* Summary & confirm */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Packs</span>
                <span className="font-medium">{packIds.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Merchant</span>
                <span className="font-medium">{selectedMerchant?.name || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ship date</span>
                <span className="font-medium">{shippedDate ? format(shippedDate, 'dd MMM yyyy') : '—'}</span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleAssign}
              disabled={isAssigning || packIds.length === 0 || !merchantId || !shippedDate}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" />
                  Assign {packIds.length} Pack{packIds.length !== 1 ? 's' : ''} to Merchant
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AssignPacksTab;
