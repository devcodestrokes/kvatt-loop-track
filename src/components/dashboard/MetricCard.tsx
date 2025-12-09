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
    icon: 'icon-subtle',
    gradient: true,
  },
  blue: {
    icon: 'flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/10 text-foreground',
    gradient: false,
  },
  brown: {
    icon: 'flex h-11 w-11 items-center justify-center rounded-xl bg-kvatt-brown/10 text-kvatt-brown',
    gradient: false,
  },
  muted: {
    icon: 'flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground',
    gradient: false,
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
      className="metric-card group animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      {/* Decorative gradient orb */}
      {styles.gradient && (
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-primary/20 to-kvatt-orange/10 blur-2xl transition-all duration-500 group-hover:scale-110" />
      )}
      
      <div className="relative flex items-start justify-between">
        <div className={styles.icon}>
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              isPositive
                ? 'bg-primary/10 text-primary'
                : 'bg-destructive/10 text-destructive'
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      <div className="relative mt-5">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className={cn(
          "mt-2 text-4xl font-bold tracking-tight",
          styles.gradient ? "text-gradient" : "text-foreground"
        )}>
          {value}
        </p>
        {changeLabel && (
          <p className="mt-2 text-xs font-medium text-muted-foreground">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}
