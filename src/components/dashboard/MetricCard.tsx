import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'amber' | 'red';
  delay?: number;
}

const colorStyles = {
  green: {
    icon: 'bg-kvatt-green/10 text-kvatt-green ring-kvatt-green/20',
    glow: 'group-hover:shadow-[0_0_30px_hsl(var(--kvatt-green)/0.2)]',
  },
  blue: {
    icon: 'bg-kvatt-blue/10 text-kvatt-blue ring-kvatt-blue/20',
    glow: 'group-hover:shadow-[0_0_30px_hsl(var(--kvatt-blue)/0.2)]',
  },
  amber: {
    icon: 'bg-kvatt-amber/10 text-kvatt-amber ring-kvatt-amber/20',
    glow: 'group-hover:shadow-[0_0_30px_hsl(var(--kvatt-amber)/0.2)]',
  },
  red: {
    icon: 'bg-kvatt-red/10 text-kvatt-red ring-kvatt-red/20',
    glow: 'group-hover:shadow-[0_0_30px_hsl(var(--kvatt-red)/0.2)]',
  },
};

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  color,
  delay = 0,
}: MetricCardProps) {
  const styles = colorStyles[color];
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        'metric-card group transition-all duration-300',
        styles.glow,
        'animate-slide-up'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg ring-1',
            styles.icon
          )}
        >
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
              isPositive
                ? 'bg-kvatt-green/10 text-kvatt-green'
                : 'bg-kvatt-red/10 text-kvatt-red'
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
        {changeLabel && (
          <p className="mt-1 text-xs text-muted-foreground">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}
