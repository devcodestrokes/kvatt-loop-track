import { useState, useEffect, useRef } from 'react';
import { format, startOfWeek, addDays, getISOWeek, isAfter, isBefore, max, min } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Download, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { DateRange } from '@/types/analytics';

interface DailyChartData {
  day: string;
  date: Date;
  totalOrders: number;
  totalOptIns: number;
  optInRate: string;
}

interface WeeklyPerformanceChartProps {
  fetchDailyData: (date: Date) => Promise<{ checkouts: number; optIns: number; optOuts: number }>;
  selectedStores: string[];
  isLoading?: boolean;
  dateRange?: DateRange;
}

export function WeeklyPerformanceChart({ fetchDailyData, selectedStores, isLoading: externalLoading, dateRange }: WeeklyPerformanceChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Initialize week start based on dateRange if provided
  const getInitialWeekStart = () => {
    if (dateRange?.from) {
      return startOfWeek(dateRange.from, { weekStartsOn: 1 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  };
  
  const [weekStart, setWeekStart] = useState(getInitialWeekStart);
  const [chartData, setChartData] = useState<DailyChartData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Update week start when dateRange changes
  useEffect(() => {
    if (dateRange?.from) {
      const newWeekStart = startOfWeek(dateRange.from, { weekStartsOn: 1 });
      setWeekStart(newWeekStart);
    }
  }, [dateRange?.from?.getTime()]);

  const weekNumber = getISOWeek(weekStart);
  const weekEnd = addDays(weekStart, 6);

  useEffect(() => {
    const loadWeekData = async () => {
      setIsLoading(true);
      const days: DailyChartData[] = [];

      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const dayName = format(date, 'EEE'); // Short day name
        
        // Check if date is within the selected date range
        const isWithinRange = (!dateRange?.from || date >= dateRange.from) && 
                              (!dateRange?.to || date <= dateRange.to);
        
        if (date <= new Date() && isWithinRange) {
          try {
            const data = await fetchDailyData(date);
            const optInRate = data.checkouts > 0 
              ? ((data.optIns / data.checkouts) * 100).toFixed(2)
              : '0';
            
            days.push({
              day: dayName,
              date,
              totalOrders: data.checkouts,
              totalOptIns: data.optIns,
              optInRate,
            });
          } catch {
            days.push({
              day: dayName,
              date,
              totalOrders: 0,
              totalOptIns: 0,
              optInRate: '0',
            });
          }
        } else {
          days.push({
            day: dayName,
            date,
            totalOrders: 0,
            totalOptIns: 0,
            optInRate: date > new Date() ? '-' : (isWithinRange ? '0' : '-'),
          });
        }
      }

      setChartData(days);
      setIsLoading(false);
    };

    loadWeekData();
  }, [weekStart, fetchDailyData, selectedStores, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  // Check if we can navigate to previous/next week based on date range
  const canNavigatePrev = () => {
    if (!dateRange?.from) return true;
    const prevWeekEnd = addDays(weekStart, -1);
    return prevWeekEnd >= dateRange.from;
  };

  const canNavigateNext = () => {
    const nextWeekStart = addDays(weekStart, 7);
    if (nextWeekStart > new Date()) return false;
    if (!dateRange?.to) return true;
    return nextWeekStart <= dateRange.to;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekStart(prev => addDays(prev, direction === 'prev' ? -7 : 7));
  };

  const goToCurrentWeek = () => {
    // Go to the latest valid week within the date range
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    if (dateRange?.to && currentWeekStart > dateRange.to) {
      setWeekStart(startOfWeek(dateRange.to, { weekStartsOn: 1 }));
    } else {
      setWeekStart(currentWeekStart);
    }
  };

  const exportAsImage = async () => {
    if (!chartRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `kvatt-weekly-performance-W${weekNumber}-${format(weekStart, 'yyyy')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast.success('Chart exported as image');
    } catch (error) {
      toast.error('Failed to export chart');
    } finally {
      setIsExporting(false);
    }
  };

  const isCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime() === weekStart.getTime();
  const isFutureWeek = weekStart > new Date();

  // Calculate totals
  const totals = chartData.reduce(
    (acc, day) => ({
      totalOrders: acc.totalOrders + day.totalOrders,
      totalOptIns: acc.totalOptIns + day.totalOptIns,
    }),
    { totalOrders: 0, totalOptIns: 0 }
  );

  const totalOptInRate = totals.totalOrders > 0 
    ? ((totals.totalOptIns / totals.totalOrders) * 100).toFixed(2)
    : '0.00';

  // Custom tick for X axis showing day and opt-in rate
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const dataItem = chartData.find(d => d.day === payload.value);
    const rate = dataItem?.optInRate || '0';
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={16} 
          textAnchor="middle" 
          className="text-xs fill-muted-foreground"
        >
          {payload.value}
        </text>
        <text 
          x={0} 
          y={16} 
          dy={16} 
          textAnchor="middle" 
          className="text-xs font-medium"
          fill={parseFloat(rate) > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
        >
          {rate === '-' ? '-' : `${rate}%`}
        </text>
      </g>
    );
  };

  return (
    <div className="data-table">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Daily Performance - W{weekNumber}</h3>
            <p className="text-sm text-muted-foreground">
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('prev')}
            disabled={!canNavigatePrev()}
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
            disabled={!canNavigateNext()}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportAsImage} 
            className="gap-2 ml-2"
            disabled={isExporting || isLoading}
          >
            <Image className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export Image'}
          </Button>
        </div>
      </div>

      <div ref={chartRef} className="p-6 bg-background">
        {/* Header for export */}
        <div className="mb-4 text-center hidden" id="export-header">
          <h3 className="text-lg font-semibold">Daily Performance - W{weekNumber}</h3>
          <p className="text-sm text-muted-foreground">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>

        {isLoading || externalLoading ? (
          <div className="h-[350px] flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis 
                    dataKey="day" 
                    tick={<CustomXAxisTick />}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    height={50}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(),
                      name === 'totalOrders' ? 'Total Orders' : 'Total Opt-ins'
                    ]}
                    labelFormatter={(label) => {
                      const item = chartData.find(d => d.day === label);
                      return item ? format(item.date, 'EEEE, MMM d') : label;
                    }}
                  />
                  <Legend 
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 20 }}
                    formatter={(value) => (
                      <span className="text-sm text-foreground">
                        {value === 'totalOrders' ? 'Total Orders' : 'Total Opt-ins'}
                      </span>
                    )}
                  />
                  <Bar 
                    dataKey="totalOrders" 
                    fill="hsl(var(--muted-foreground))"
                    radius={[4, 4, 0, 0]}
                    name="totalOrders"
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`orders-${index}`} 
                        fill={entry.date > new Date() ? 'hsl(var(--muted))' : 'hsl(220, 10%, 75%)'}
                      />
                    ))}
                  </Bar>
                  <Bar 
                    dataKey="totalOptIns" 
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="totalOptIns"
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`optins-${index}`} 
                        fill={entry.date > new Date() ? 'hsl(var(--muted))' : 'hsl(var(--primary))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Summary */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(220, 10%, 75%)' }} />
                <span className="text-muted-foreground">Total Orders:</span>
                <span className="font-semibold text-foreground">{totals.totalOrders.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary" />
                <span className="text-muted-foreground">Total Opt-ins:</span>
                <span className="font-semibold text-primary">{totals.totalOptIns.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Avg Rate:</span>
                <span className="font-semibold text-primary">{totalOptInRate}%</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
