import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Store as StoreIcon } from 'lucide-react';
import { Store } from '@/types/analytics';

interface StoreSelectorProps {
  stores: Store[];
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  disabled?: boolean;
}

export function StoreSelector({
  stores,
  selectedStore,
  onStoreChange,
  disabled,
}: StoreSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <StoreIcon className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedStore} onValueChange={onStoreChange} disabled={disabled}>
        <SelectTrigger className="w-[200px] bg-secondary border-border">
          <SelectValue placeholder="Select store" />
        </SelectTrigger>
        <SelectContent>
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
