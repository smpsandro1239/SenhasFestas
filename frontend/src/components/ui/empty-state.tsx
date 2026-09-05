import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8',
        className,
      )}
    >
      {icon && (
        <div className="mb-3 p-3 rounded-2xl bg-surface text-zinc-500">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-zinc-300">{title}</h3>
      {description && <p className="mt-1 text-sm text-zinc-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
