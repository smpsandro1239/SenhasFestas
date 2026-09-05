import { cn } from '@/lib/cn';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  message: string;
  className?: string;
  onClose?: () => void;
}

const variantStyles: Record<AlertVariant, { container: string; icon: string; iconPath: string }> = {
  success: {
    container: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    icon: 'text-emerald-400',
    iconPath: 'M20 6L9 17l-5-5',
  },
  error: {
    container: 'border-red-500/30 bg-red-500/10 text-red-300',
    icon: 'text-red-400',
    iconPath: 'M6 6l12 12M18 6L6 18',
  },
  warning: {
    container: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    icon: 'text-orange-400',
    iconPath: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  },
  info: {
    container: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    icon: 'text-blue-400',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

export function Alert({ variant = 'info', message, className, onClose }: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-sm',
        styles.container,
        'animate-slide-down',
        className,
      )}
    >
      <svg className={cn('h-5 w-5 shrink-0 mt-0.5', styles.icon)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={styles.iconPath} />
      </svg>
      <div className="flex-1">{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Fechar"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
