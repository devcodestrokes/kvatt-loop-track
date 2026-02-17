import { useState, useRef } from 'react';
import { Upload, FileText, Brain, X, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CSVUploadAnalysisProps {
  onAnalysisComplete: (analysis: any) => void;
  onDataImported: () => void;
}

export const CSVUploadAnalysis = ({ onAnalysisComplete, onDataImported }: CSVUploadAnalysisProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setImportedCount(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.csv')) {
        toast.error('Please drop a CSV file');
        return;
      }
      setFile(droppedFile);
      setImportedCount(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearFile = () => {
    setFile(null);
    setImportedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadAndImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const totalLines = lines.length - 1; // Exclude header
      
      // Split into batches of 1000 lines for processing
      const batchSize = 1000;
      const headerLine = lines[0];
      let processedLines = 0;
      let totalInserted = 0;

      for (let i = 1; i < lines.length; i += batchSize) {
        const batchLines = lines.slice(i, i + batchSize);
        const batchData = [headerLine, ...batchLines].join('\n');
        
        const { data, error } = await supabase.functions.invoke('import-orders-csv', {
          body: { csvData: batchData, batchNumber: Math.floor(i / batchSize) + 1 }
        });

        if (error) throw error;
        
        processedLines += batchLines.length;
        totalInserted += data?.inserted || 0;
        setUploadProgress(Math.round((processedLines / totalLines) * 100));
      }

      setImportedCount(totalInserted);
      toast.success(`Imported ${totalInserted.toLocaleString()} orders successfully`);
      onDataImported();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import CSV');
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);

    try {
      // First, get the imported data summary from the database
      const { data: orders, error: fetchError } = await supabase
        .from('imported_orders')
        .select('*')
        .eq('hidden', false)
        .limit(5000);

      if (fetchError) throw fetchError;
      if (!orders || orders.length === 0) {
        toast.error('No imported data found. Please upload a CSV first.');
        setIsAnalyzing(false);
        return;
      }

      // Process data for analysis
      const totalOrders = orders.length;
      const optIns = orders.filter(o => o.opt_in === true).length;
      const optOuts = totalOrders - optIns;
      const optInRate = totalOrders > 0 ? ((optIns / totalOrders) * 100).toFixed(2) : '0';

      // Calculate average order values
      const optInOrders = orders.filter(o => o.opt_in === true);
      const optOutOrders = orders.filter(o => o.opt_in === false);
      const avgOptInValue = optInOrders.length > 0 
        ? (optInOrders.reduce((sum, o) => sum + (o.total_price || 0), 0) / optInOrders.length).toFixed(2)
        : '0';
      const avgOptOutValue = optOutOrders.length > 0
        ? (optOutOrders.reduce((sum, o) => sum + (o.total_price || 0), 0) / optOutOrders.length).toFixed(2)
        : '0';

      // Geographic analysis
      const cityStats: Record<string, { total: number; optIn: number }> = {};
      const countryStats: Record<string, { total: number; optIn: number }> = {};
      const storeStats: Record<string, { total: number; optIn: number; revenue: number }> = {};

      orders.forEach(order => {
        // City stats
        if (order.city) {
          if (!cityStats[order.city]) cityStats[order.city] = { total: 0, optIn: 0 };
          cityStats[order.city].total++;
          if (order.opt_in) cityStats[order.city].optIn++;
        }
        // Country stats
        if (order.country) {
          if (!countryStats[order.country]) countryStats[order.country] = { total: 0, optIn: 0 };
          countryStats[order.country].total++;
          if (order.opt_in) countryStats[order.country].optIn++;
        }
        // Store stats
        if (order.store_id) {
          if (!storeStats[order.store_id]) storeStats[order.store_id] = { total: 0, optIn: 0, revenue: 0 };
          storeStats[order.store_id].total++;
          if (order.opt_in) storeStats[order.store_id].optIn++;
          storeStats[order.store_id].revenue += order.total_price || 0;
        }
      });

      const topCities = Object.entries(cityStats)
        .map(([name, stats]) => ({
          name,
          total: stats.total,
          optIn: stats.optIn,
          optInRate: ((stats.optIn / stats.total) * 100).toFixed(2)
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const topCountries = Object.entries(countryStats)
        .map(([name, stats]) => ({
          name,
          total: stats.total,
          optIn: stats.optIn,
          optInRate: ((stats.optIn / stats.total) * 100).toFixed(2)
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const stores = Object.entries(storeStats)
        .map(([storeId, stats]) => ({
          storeId,
          total: stats.total,
          optIn: stats.optIn,
          optInRate: ((stats.optIn / stats.total) * 100).toFixed(2),
          avgOrderValue: (stats.revenue / stats.total).toFixed(2)
        }))
        .sort((a, b) => b.total - a.total);

      const analyticsData = {
        summary: {
          totalOrders,
          totalOptIns: optIns,
          totalOptOuts: optOuts,
          optInRate,
          avgOptInOrderValue: avgOptInValue,
          avgOptOutOrderValue: avgOptOutValue,
          valueDifference: (parseFloat(avgOptInValue) - parseFloat(avgOptOutValue)).toFixed(2)
        },
        geographic: {
          topCities,
          topCountries,
          bestCitiesByOptIn: [...topCities].sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate)).slice(0, 10)
        },
        stores
      };

      // Call AI analysis
      const { data, error } = await supabase.functions.invoke('analyze-cro-patterns', {
        body: { analyticsData }
      });

      if (error) throw error;

      if (data?.data?.analysis) {
        onAnalysisComplete(data.data.analysis);
        toast.success('AI analysis complete');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || 'Failed to run AI analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">Upload CSV for AI Analysis</h3>
          <p className="text-xs text-muted-foreground">Import order data and get AI-powered CRO insights</p>
        </div>
      </div>

      {!file ? (
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag & drop your CSV file here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Supports order data with opt-in, store, and location fields
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={clearFile} disabled={isUploading || isAnalyzing}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Importing data...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {importedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle className="h-4 w-4" />
              <span>{importedCount.toLocaleString()} orders imported successfully</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={uploadAndImport} 
              disabled={isUploading || isAnalyzing}
              variant="outline"
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </>
              )}
            </Button>
            <Button 
              onClick={runAIAnalysis} 
              disabled={isUploading || isAnalyzing}
              className="flex-1"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Run AI Analysis
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
