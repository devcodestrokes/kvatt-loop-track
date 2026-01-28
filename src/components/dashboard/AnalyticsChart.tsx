import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AnalyticsData } from '@/types/analytics';
import { getDisplayStoreName } from '@/hooks/useAnalytics';

interface AnalyticsChartProps {
  data: AnalyticsData[];
  type?: 'bar' | 'pie';
  onPieClick?: () => void;
}

const COLORS = {
  optIn: '#fe655b',           // Kvatt coral
  optOut: 'hsl(0, 0%, 45%)',  // Grey
  total: 'hsl(0, 0%, 15%)',   // Black
};

// Generate distinct colors for each store
const generateStoreColors = (count: number) => {
  const baseColors = [
    '#fe655b', // Kvatt coral
    '#2d2d2d', // Black
    '#737373', // Grey
    '#ff8a80', // Light coral
    '#4a4a4a', // Dark grey
    '#ffa69e', // Lighter coral
    '#5c5c5c', // Medium grey
    '#ffb8b0', // Very light coral
    '#8c8c8c', // Light grey
    '#a3a3a3', // Lighter grey
  ];
  return baseColors.slice(0, count);
};

export function AnalyticsChart({ data, type = 'bar', onPieClick }: AnalyticsChartProps) {
  const chartData = data.map((item) => ({
    name: getDisplayStoreName(item.store),
    'Opt-ins': item.opt_ins || 0,
    'Opt-outs': item.opt_outs || 0,
    'Total Checkouts': item.total_checkouts || 0,
  }));

  // Pie data showing opt-ins by store (filter out stores with 0 opt-ins)
  const pieData = data
    .filter(item => (item.opt_ins || 0) > 0)
    .map((item) => ({
      name: getDisplayStoreName(item.store),
      value: item.opt_ins || 0,
    }));

  const storeColors = generateStoreColors(pieData.length);

  if (type === 'pie') {
    return (
      <div 
        className={`chart-container h-full ${onPieClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
        onClick={onPieClick}
      >
        <h3 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
          Opt-ins by Store
          {onPieClick && <span className="text-xs text-muted-foreground font-normal">(click to view details)</span>}
        </h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={storeColors[index % storeColors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(40, 15%, 98%)',
                  border: '1px solid hsl(40, 10%, 85%)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                formatter={(value: number, name: string) => [`${value} opt-ins`, name]}
              />
              <Legend 
                layout="horizontal" 
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Store Performance</h3>
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 10%, 85%)" />
            <XAxis
              dataKey="name"
              stroke="hsl(20, 10%, 45%)"
              tick={{ fill: 'hsl(20, 10%, 45%)', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis stroke="hsl(20, 10%, 45%)" tick={{ fill: 'hsl(20, 10%, 45%)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(40, 15%, 98%)',
                border: '1px solid hsl(40, 10%, 85%)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Legend />
            <Bar dataKey="Opt-ins" fill={COLORS.optIn} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Opt-outs" fill={COLORS.optOut} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Total Checkouts" fill={COLORS.total} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
