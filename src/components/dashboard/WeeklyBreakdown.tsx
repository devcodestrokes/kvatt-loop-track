import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, addDays, getISOWeek, isWithinInterval, isBefore, isAfter, max, min } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface DailyData {
  date: Date;
  dayName: string;
  checkouts: number;
  optIns: number;
  optOuts: number;
  optInRate: string;
  isInSelectedRange: boolean;
}

interface WeeklyBreakdownProps {
  fetchDailyData: (date: Date) => Promise<{ checkouts: number; optIns: number; optOuts: number }>;
  selectedStores: string[];
  isLoading?: boolean;
  dateRange?: { from?: Date; to?: Date };
}

export function WeeklyBreakdown({ fetchDailyData, selectedStores, isLoading: externalLoading, dateRange }: WeeklyBreakdownProps) {
  // Calculate weeks within the date range
  const weeksInRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      // Default to current week if no range
      return [startOfWeek(new Date(), { weekStartsOn: 1 })];
    }
    
    const weeks: Date[] = [];
    let currentWeekStart = startOfWeek(dateRange.from, { weekStartsOn: 1 });
    const rangeEnd = dateRange.to;
    
    while (isBefore(currentWeekStart, rangeEnd) || currentWeekStart.getTime() === startOfWeek(rangeEnd, { weekStartsOn: 1 }).getTime()) {
      weeks.push(currentWeekStart);
      currentWeekStart = addDays(currentWeekStart, 7);
    }
    
    return weeks;
  }, [dateRange]);

  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Reset to first week when date range changes
  useEffect(() => {
    setCurrentWeekIndex(0);
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  const weekStart = weeksInRange[currentWeekIndex] || startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekNumber = getISOWeek(weekStart);
  const weekEnd = addDays(weekStart, 6);

  useEffect(() => {
    const loadWeekData = async () => {
      setIsLoading(true);
      const days: DailyData[] = [];

      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const dayName = format(date, 'EEEE');
        
        // Check if date is within the selected date range (for highlighting)
        const isInSelectedRange = dateRange?.from && dateRange?.to
          ? isWithinInterval(date, { start: dateRange.from, end: dateRange.to })
          : true; // If no range selected, all days are "in range"
        
        // Always fetch data for past/current days (regardless of date range filter)
        if (date <= new Date()) {
          try {
            const data = await fetchDailyData(date);
            const optInRate = data.checkouts > 0 
              ? ((data.optIns / data.checkouts) * 100).toFixed(2)
              : '0.00';
            
            days.push({
              date,
              dayName,
              checkouts: data.checkouts,
              optIns: data.optIns,
              optOuts: data.optOuts,
              optInRate,
              isInSelectedRange,
            });
          } catch {
            days.push({
              date,
              dayName,
              checkouts: 0,
              optIns: 0,
              optOuts: 0,
              optInRate: '0.00',
              isInSelectedRange,
            });
          }
        } else {
          // Future days
          days.push({
            date,
            dayName,
            checkouts: 0,
            optIns: 0,
            optOuts: 0,
            optInRate: '-',
            isInSelectedRange,
          });
        }
      }

      setDailyData(days);
      setIsLoading(false);
    };

    loadWeekData();
  }, [weekStart, fetchDailyData, selectedStores, dateRange]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentWeekIndex > 0) {
      setCurrentWeekIndex(prev => prev - 1);
    } else if (direction === 'next' && currentWeekIndex < weeksInRange.length - 1) {
      setCurrentWeekIndex(prev => prev + 1);
    }
  };

  const goToCurrentWeek = () => {
    // Find the week that contains today within the range
    const today = new Date();
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const index = weeksInRange.findIndex(w => w.getTime() === todayWeekStart.getTime());
    if (index >= 0) {
      setCurrentWeekIndex(index);
    } else {
      // If today is not in range, go to the last week in range
      setCurrentWeekIndex(weeksInRange.length - 1);
    }
  };

  const totals = dailyData.reduce(
    (acc, day) => ({
      checkouts: acc.checkouts + day.checkouts,
      optIns: acc.optIns + day.optIns,
      optOuts: acc.optOuts + day.optOuts,
    }),
    { checkouts: 0, optIns: 0, optOuts: 0 }
  );

  const totalOptInRate = totals.checkouts > 0 
    ? ((totals.optIns / totals.checkouts) * 100).toFixed(2)
    : '0.00';

  const exportWeeklyCSV = () => {
    const headers = ['Date', 'Day', 'ISO Week', 'Checkouts', 'Opt-ins', 'Opt-outs', 'Opt-in Rate'];
    const rows = dailyData.map((day) => [
      format(day.date, 'yyyy-MM-dd'),
      day.dayName,
      `Week ${getISOWeek(day.date)}`,
      day.checkouts,
      day.optIns,
      day.optOuts,
      day.optInRate === '-' ? '-' : `${day.optInRate}%`,
    ]);

    // Add totals row
    rows.push([
      'TOTAL',
      '',
      `Week ${weekNumber}`,
      totals.checkouts,
      totals.optIns,
      totals.optOuts,
      `${totalOptInRate}%`,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kvatt-weekly-week${weekNumber}-${format(weekStart, 'yyyy')}.csv`;
    a.click();
  };

  const canNavigatePrev = currentWeekIndex > 0;
  const canNavigateNext = currentWeekIndex < weeksInRange.length - 1;
  const isCurrentWeekInRange = weeksInRange.some(w => w.getTime() === startOfWeek(new Date(), { weekStartsOn: 1 }).getTime());
  const isOnCurrentWeek = weeksInRange[currentWeekIndex]?.getTime() === startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();

  return (
    <div className="data-table">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Weekly Breakdown</h3>
            <p className="text-sm text-muted-foreground">
              Week {weekNumber} • {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
              {weeksInRange.length > 1 && <span className="ml-2 text-xs">({currentWeekIndex + 1} of {weeksInRange.length})</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('prev')}
            disabled={!canNavigatePrev}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToCurrentWeek}
            disabled={!isCurrentWeekInRange || isOnCurrentWeek}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('next')}
            disabled={!canNavigateNext}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportWeeklyCSV} className="gap-2 ml-2">
            <Download className="h-4 w-4" />
            Export Week
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-muted-foreground">Day</TableHead>
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-right text-muted-foreground">Checkouts</TableHead>
              <TableHead className="text-right text-muted-foreground">Opt-ins</TableHead>
              <TableHead className="text-right text-muted-foreground">Opt-outs</TableHead>
              <TableHead className="text-right text-muted-foreground">Opt-in Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || externalLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (
              <>
                {dailyData.map((day, index) => {
                  const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  const isFuture = day.date > new Date();
                  const hasDateFilter = dateRange?.from && dateRange?.to;
                  const isHighlighted = hasDateFilter && day.isInSelectedRange;
                  const isDimmed = hasDateFilter && !day.isInSelectedRange && !isFuture;
                  
                  return (
                    <TableRow 
                      key={index} 
                      className={`border-border transition-colors ${
                        isToday ? 'bg-primary/5' : ''
                      } ${isFuture ? 'opacity-50' : ''} ${
                        isHighlighted ? 'bg-primary/8 border-l-2 border-l-primary' : ''
                      } ${isDimmed ? 'opacity-60' : ''}`}
                    >
                      <TableCell className="font-medium text-foreground">
                        {day.dayName}
                        {isToday && <span className="ml-2 text-xs text-primary">(Today)</span>}
                        {isHighlighted && !isToday && <span className="ml-2 text-xs text-primary/70">●</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(day.date, 'MMM d')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-foreground">
                        {isFuture ? '-' : day.checkouts.toLocaleString()}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${isHighlighted ? 'text-primary font-semibold' : 'text-primary'}`}>
                        {isFuture ? '-' : day.optIns.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {isFuture ? '-' : day.optOuts.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {isFuture ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              parseFloat(day.optInRate) >= 50
                                ? 'bg-primary/10 text-primary'
                                : parseFloat(day.optInRate) >= 25
                                ? 'bg-chart-total/10 text-chart-total'
                                : 'bg-muted text-muted-foreground'
                            } ${isHighlighted ? 'ring-1 ring-primary/30' : ''}`}
                          >
                            {day.optInRate}%
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals row */}
                <TableRow className="border-border bg-muted/50 font-semibold">
                  <TableCell className="text-foreground">Week Total</TableCell>
                  <TableCell className="text-muted-foreground">Week {weekNumber}</TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {totals.checkouts.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-primary">
                    {totals.optIns.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {totals.optOuts.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary">
                      {totalOptInRate}%
                    </span>
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
