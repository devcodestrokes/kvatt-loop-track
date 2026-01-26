import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DateRange } from '@/types/analytics';

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  disabled?: boolean;
}

const presets = [
  {
    label: 'Today',
    getValue: () => ({ from: new Date(), to: new Date() }),
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: yesterday, to: yesterday };
    },
  },
  {
    label: 'Last 7 days',
    getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    label: 'Last 30 days',
    getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  },
  {
    label: 'This month',
    getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  {
    label: 'Last month',
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    },
  },
];

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  disabled,
}: DateRangePickerProps) {
  const [tempRange, setTempRange] = useState<DateRange>(dateRange);
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = () => {
    if (tempRange.from && tempRange.to) {
      onDateRangeChange(tempRange);
      setIsOpen(false);
    }
  };

  const handlePresetSelect = (range: DateRange) => {
    onDateRangeChange(range);
    setTempRange(range);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setTempRange(dateRange);
    }
    setIsOpen(open);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.label}
              onClick={() => handlePresetSelect(preset.getValue())}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[280px] justify-start text-left font-normal bg-secondary border-border',
              !dateRange.from && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'LLL dd, y')} -{' '}
                  {format(dateRange.to, 'LLL dd, y')}
                </>
              ) : (
                format(dateRange.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={tempRange.from}
            selected={{ from: tempRange.from, to: tempRange.to }}
            onSelect={(range) =>
              setTempRange({ from: range?.from, to: range?.to })
            }
            numberOfMonths={2}
          />
          <div className="flex items-center justify-end gap-2 p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!tempRange.from || !tempRange.to}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}