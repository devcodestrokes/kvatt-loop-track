import { Store as StoreIcon, Check, ChevronDown } from 'lucide-react';
import { Store } from '@/types/analytics';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface MultiStoreSelectorProps {
  stores: Store[];
  selectedStores: string[];
  onToggleStore: (storeId: string) => void;
  onSelectAll: () => void;
  onUnselectAll: () => void;
  disabled?: boolean;
}

export function MultiStoreSelector({
  stores,
  selectedStores,
  onToggleStore,
  onSelectAll,
  onUnselectAll,
  disabled,
}: MultiStoreSelectorProps) {
  const isAllSelected = stores.length > 0 && selectedStores.length === stores.length;
  const selectedCount = selectedStores.length;

  const getDisplayText = () => {
    if (selectedCount === 0) return 'No stores selected';
    if (isAllSelected) return 'All stores';
    if (selectedCount === 1) {
      const store = stores.find(s => s.id === selectedStores[0]);
      return store?.name || '1 store';
    }
    return `${selectedCount} stores`;
  };

  return (
    <div className="flex items-center gap-2">
      <StoreIcon className="h-4 w-4 text-muted-foreground" />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn(
              "w-[200px] justify-between bg-secondary border-border",
              selectedCount === 0 && "text-muted-foreground"
            )}
          >
            <span className="truncate">{getDisplayText()}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0 bg-popover z-50" align="start">
          <div className="p-2 space-y-1">
            {/* Select All / Unselect All */}
            <div className="flex gap-2 pb-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={onSelectAll}
                disabled={isAllSelected}
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={onUnselectAll}
                disabled={selectedCount === 0}
              >
                Unselect all
              </Button>
            </div>
            <Separator />
            {/* Store List */}
            <div className="max-h-[200px] overflow-y-auto py-2 space-y-1">
              {stores.map((store) => {
                const isSelected = selectedStores.includes(store.id);
                return (
                  <div
                    key={store.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors",
                      isSelected && "bg-accent/50"
                    )}
                    onClick={() => onToggleStore(store.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleStore(store.id)}
                      className="pointer-events-none"
                    />
                    <span className="text-sm truncate flex-1">{store.name}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                );
              })}
              {stores.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No stores available
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
