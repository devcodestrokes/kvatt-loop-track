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
  optIn: 'hsl(142, 76%, 46%)',
  optOut: 'hsl(0, 72%, 51%)',
  total: 'hsl(210, 100%, 56%)',
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
      <div className="chart-container">
        <h3 className="mb-4 text-lg font-semibold">Opt-in Distribution</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
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
                  backgroundColor: 'hsl(220, 16%, 10%)',
                  border: '1px solid hsl(220, 14%, 16%)',
                  borderRadius: '8px',
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
      <h3 className="mb-4 text-lg font-semibold">Store Performance</h3>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
            <XAxis
              dataKey="name"
              stroke="hsl(220, 14%, 55%)"
              tick={{ fill: 'hsl(220, 14%, 55%)', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis stroke="hsl(220, 14%, 55%)" tick={{ fill: 'hsl(220, 14%, 55%)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220, 16%, 10%)',
                border: '1px solid hsl(220, 14%, 16%)',
                borderRadius: '8px',
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
