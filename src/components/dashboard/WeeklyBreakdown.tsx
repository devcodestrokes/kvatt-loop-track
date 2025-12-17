import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, getISOWeek } from 'date-fns';
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
}

interface WeeklyBreakdownProps {
  fetchDailyData: (date: Date) => Promise<{ checkouts: number; optIns: number; optOuts: number }>;
  selectedStores: string[];
  isLoading?: boolean;
}

export function WeeklyBreakdown({ fetchDailyData, selectedStores, isLoading: externalLoading }: WeeklyBreakdownProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const weekNumber = getISOWeek(weekStart);
  const weekEnd = addDays(weekStart, 6);

  useEffect(() => {
    const loadWeekData = async () => {
      setIsLoading(true);
      const days: DailyData[] = [];

      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const dayName = format(date, 'EEEE');
        
        // Only fetch data for past/current days
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
            });
          } catch {
            days.push({
              date,
              dayName,
              checkouts: 0,
              optIns: 0,
              optOuts: 0,
              optInRate: '0.00',
            });
          }
        } else {
          days.push({
            date,
            dayName,
            checkouts: 0,
            optIns: 0,
            optOuts: 0,
            optInRate: '-',
          });
        }
      }

      setDailyData(days);
      setIsLoading(false);
    };

    loadWeekData();
  }, [weekStart, fetchDailyData, selectedStores]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekStart(prev => addDays(prev, direction === 'prev' ? -7 : 7));
  };

  const goToCurrentWeek = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
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

  const isCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime() === weekStart.getTime();
  const isFutureWeek = weekStart > new Date();

  return (
    <div className="data-table">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Weekly Breakdown</h3>
            <p className="text-sm text-muted-foreground">
              Week {weekNumber} • {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('prev')}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToCurrentWeek}
            disabled={isCurrentWeek}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('next')}
            disabled={isFutureWeek}
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
                  
                  return (
                    <TableRow 
                      key={index} 
                      className={`border-border ${isToday ? 'bg-primary/5' : ''} ${isFuture ? 'opacity-50' : ''}`}
                    >
                      <TableCell className="font-medium text-foreground">
                        {day.dayName}
                        {isToday && <span className="ml-2 text-xs text-primary">(Today)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(day.date, 'MMM d')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-foreground">
                        {isFuture ? '-' : day.checkouts.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary">
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
                            }`}
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
