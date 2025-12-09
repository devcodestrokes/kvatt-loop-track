import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: 'coral' | 'blue' | 'brown' | 'muted';
  delay?: number;
}

const colorStyles = {
  coral: {
    icon: 'bg-primary/10 text-primary',
    border: 'hover:border-primary/30',
  },
  blue: {
    icon: 'bg-chart-total/10 text-chart-total',
    border: 'hover:border-chart-total/30',
  },
  brown: {
    icon: 'bg-kvatt-brown/10 text-kvatt-brown',
    border: 'hover:border-kvatt-brown/30',
  },
  muted: {
    icon: 'bg-muted-foreground/10 text-muted-foreground',
    border: 'hover:border-muted-foreground/30',
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
        'metric-card group animate-slide-up',
        styles.border
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            styles.icon
          )}
        >
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
              isPositive
                ? 'bg-primary/10 text-primary'
                : 'bg-destructive/10 text-destructive'
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
        <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        {changeLabel && (
          <p className="mt-1 text-xs text-muted-foreground">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}
