import { useState, useCallback } from 'react';
import { Package, Upload, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ValidationResult {
  valid: string[];
  notFound: string[];
  alreadyGrouped: string[];
  total: number;
}

interface CreateGroupDialogProps {
  onValidate: (packIds: string[]) => Promise<ValidationResult | null>;
  onCreate: (packIds: string[]) => Promise<any>;
  isLoading: boolean;
}

const CreateGroupDialog = ({ onValidate, onCreate, isLoading }: CreateGroupDialogProps) => {
  const [open, setOpen] = useState(false);
  const [packIdsText, setPackIdsText] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [step, setStep] = useState<'input' | 'validated'>('input');

  const parsePackIds = (text: string): string[] => {
    return text
      .split(/[\n,\r]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setPackIdsText(content);
    };
    reader.readAsText(file);
  }, []);

  const handleValidate = async () => {
    const packIds = parsePackIds(packIdsText);
    if (packIds.length === 0) return;

    setIsValidating(true);
    const result = await onValidate(packIds);
    setValidation(result);
    setIsValidating(false);
    if (result) {
      setStep('validated');
    }
  };

  const handleCreate = async () => {
    if (!validation?.valid.length) return;
    await onCreate(validation.valid);
    handleReset();
  };

  const handleReset = () => {
    setOpen(false);
    setPackIdsText('');
    setValidation(null);
    setStep('input');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) handleReset();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Package className="h-4 w-4" />
          Create Group
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Pack Group</DialogTitle>
          <DialogDescription>
            Upload scanned pack IDs to create a group for outbound shipping.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload CSV/Text</TabsTrigger>
              <TabsTrigger value="paste">Paste IDs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-4">
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a CSV or text file with pack IDs (one per line)
                </p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span>
                      <FileText className="h-4 w-4 mr-2" />
                      Select File
                    </span>
                  </Button>
                </Label>
              </div>
              {packIdsText && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>File loaded</AlertTitle>
                  <AlertDescription>
                    {parsePackIds(packIdsText).length} pack IDs detected
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
            
            <TabsContent value="paste" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="packIds">Pack IDs (one per line or comma-separated)</Label>
                <Textarea
                  id="packIds"
                  placeholder="PK-ABC123&#10;PK-DEF456&#10;PK-GHI789"
                  value={packIdsText}
                  onChange={(e) => setPackIdsText(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {parsePackIds(packIdsText).length} pack IDs detected
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {step === 'validated' && validation && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-primary/10 text-center">
                <p className="text-2xl font-bold text-primary">{validation.valid.length}</p>
                <p className="text-sm text-muted-foreground">Valid & Ready</p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10 text-center">
                <p className="text-2xl font-bold text-destructive">{validation.notFound.length}</p>
                <p className="text-sm text-muted-foreground">Not Found</p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 text-center">
                <p className="text-2xl font-bold text-yellow-600">{validation.alreadyGrouped.length}</p>
                <p className="text-sm text-muted-foreground">Already Grouped</p>
              </div>
            </div>

            {validation.notFound.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Some IDs not found</AlertTitle>
                <AlertDescription>
                  <div className="max-h-20 overflow-y-auto font-mono text-xs mt-2">
                    {validation.notFound.slice(0, 10).join(', ')}
                    {validation.notFound.length > 10 && ` +${validation.notFound.length - 10} more`}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {validation.alreadyGrouped.length > 0 && (
              <Alert className="border-yellow-500/50 bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-700">Already assigned to groups</AlertTitle>
                <AlertDescription>
                  <div className="max-h-20 overflow-y-auto font-mono text-xs mt-2 text-yellow-700">
                    {validation.alreadyGrouped.slice(0, 10).join(', ')}
                    {validation.alreadyGrouped.length > 10 && ` +${validation.alreadyGrouped.length - 10} more`}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {validation.valid.length > 0 && (
              <Alert className="border-primary/50 bg-primary/10">
                <CheckCircle className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Ready to create group</AlertTitle>
                <AlertDescription>
                  {validation.valid.length} packs will be linked to a new group ID
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'input' ? (
            <>
              <Button variant="outline" onClick={handleReset}>Cancel</Button>
              <Button 
                onClick={handleValidate} 
                disabled={isValidating || parsePackIds(packIdsText).length === 0}
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Validate IDs'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>Back</Button>
              <Button 
                onClick={handleCreate} 
                disabled={isLoading || !validation?.valid.length}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create Group (${validation?.valid.length} packs)`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
