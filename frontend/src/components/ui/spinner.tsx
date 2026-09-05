import { cn } from '@/lib/cn';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeMap: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? 'A carregar'}
      className="flex flex-col items-center justify-center gap-3"
    >
      <svg
        aria-hidden="true"
        className={cn('animate-spin text-brand', sizeMap[size], className)}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {label && <span className="text-sm text-zinc-500">{label}</span>}
    </div>
  );
}
