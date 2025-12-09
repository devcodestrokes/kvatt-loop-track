import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import kvattLogo from '@/assets/kvatt-logo.jpeg';

interface HeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated?: Date;
}

export function Header({ onRefresh, isLoading, lastUpdated }: HeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <img 
          src={kvattLogo} 
          alt="Kvatt" 
          className="h-12 w-12 rounded-xl object-cover shadow-md"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Kvatt <span className="text-primary">Analytics</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Renewable packaging insights
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </header>
  );
}
