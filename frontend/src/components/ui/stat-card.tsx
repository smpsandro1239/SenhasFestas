import { cn } from '@/lib/cn';
import { Card } from './card';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: 'brand' | 'green' | 'orange' | 'blue' | 'red';
  trend?: string;
  trendType?: 'up' | 'down';
  sub?: string;
  onClick?: () => void;
}

const colorMap: Record<NonNullable<StatCardProps['color']>, { text: string; glow: string }> = {
  brand: { text: 'text-brand', glow: 'glow-amber' },
  green: { text: 'text-emerald-400', glow: 'glow-green' },
  orange: { text: 'text-orange-400', glow: 'glow-orange' },
  blue: { text: 'text-blue-400', glow: 'glow-blue' },
  red: { text: 'text-red-400', glow: 'glow-red' },
};

export function StatCard({
  label,
  value,
  icon,
  color = 'brand',
  trend,
  trendType,
  sub,
  onClick,
}: StatCardProps) {
  const palette = colorMap[color];

  return (
    <Card
      hover={!!onClick}
      onClick={onClick}
      className={cn('relative overflow-hidden', onClick && 'cursor-pointer')}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400 font-medium">{label}</p>
          <p className={cn('mt-1 text-3xl font-bold tracking-tight', palette.text)}>
            {value}
          </p>
        </div>
        {icon && (
          <div className={cn('p-2.5 rounded-xl bg-surface-solid', palette.glow)}>
            <span className={palette.text}>{icon}</span>
          </div>
        )}
      </div>
      {(trend || sub) && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          {trend && (
            <span
              className={cn(
                'font-medium',
                trendType === 'down' ? 'text-red-400' : 'text-emerald-400',
              )}
            >
              {trend}
            </span>
          )}
          {sub && <span className="text-zinc-500">{sub}</span>}
        </div>
      )}
    </Card>
  );
}
