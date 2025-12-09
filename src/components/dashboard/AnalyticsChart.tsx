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

interface AnalyticsChartProps {
  data: AnalyticsData[];
  type?: 'bar' | 'pie';
}

const COLORS = {
  optIn: 'hsl(10, 75%, 55%)',
  optOut: 'hsl(20, 10%, 45%)',
  total: 'hsl(200, 70%, 50%)',
};

export function AnalyticsChart({ data, type = 'bar' }: AnalyticsChartProps) {
  const chartData = data.map((item) => ({
    name: item.store.replace('.myshopify.com', ''),
    'Opt-ins': item.opt_ins || 0,
    'Opt-outs': item.opt_outs || 0,
    'Total Checkouts': item.total_checkouts || 0,
  }));

  const pieData = [
    { name: 'Opt-ins', value: data.reduce((acc, item) => acc + (item.opt_ins || 0), 0), color: COLORS.optIn },
    { name: 'Opt-outs', value: data.reduce((acc, item) => acc + (item.opt_outs || 0), 0), color: COLORS.optOut },
  ];

  if (type === 'pie') {
    return (
      <div className="chart-container h-full">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Opt-in Distribution</h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(40, 15%, 98%)',
                  border: '1px solid hsl(40, 10%, 85%)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Legend />
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
