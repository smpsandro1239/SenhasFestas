import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  layout?: 'inline' | 'pills' | 'underline';
  label?: string;
}

export function Tabs({
  items,
  activeTab,
  onChange,
  className,
  layout = 'pills',
  label = 'Navegação por separadores',
}: TabsProps) {
  if (layout === 'underline') {
    return (
      <div
        role="tablist"
        aria-label={label}
        className={cn('flex gap-1 border-b border-border', className)}
      >
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={activeTab === item.id}
            aria-controls={`panel-${item.id}`}
            aria-label={item.count !== undefined ? `${item.label} (${item.count})` : undefined}
            onClick={() => onChange(item.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors duration-200',
              'flex items-center gap-2 relative',
              activeTab === item.id
                ? 'text-brand'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            {item.label}
            {item.count !== undefined && (
              <span className="text-xs text-zinc-500">({item.count})</span>
            )}
            {activeTab === item.id && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-brand rounded-t-full" />
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div role="tablist" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          id={`tab-${item.id}`}
          aria-selected={activeTab === item.id}
          aria-controls={`panel-${item.id}`}
          onClick={() => onChange(item.id)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200',
            'flex items-center gap-2',
            activeTab === item.id
              ? 'bg-brand text-black shadow-glow-sm'
              : 'bg-surface border border-border text-zinc-400 hover:bg-surface-hover hover:text-zinc-200 hover:border-border-hover',
          )}
        >
          {item.icon && <span aria-hidden="true">{item.icon}</span>}
          {item.label}
          {item.count !== undefined && (
            <span
              aria-hidden="true"
              className={cn(
                'px-1.5 rounded-full text-xs',
                activeTab === item.id ? 'bg-black/15 text-black' : 'bg-surface-active text-zinc-400',
              )}
            >
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}