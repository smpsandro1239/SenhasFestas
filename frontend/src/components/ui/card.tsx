import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

type CardVariant = 'default' | 'glass' | 'glass-strong' | 'highlight';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hover?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-surface-solid border border-border',
  glass: 'glass',
  'glass-strong': 'glass-strong',
  highlight: 'bg-surface-solid border border-brand/20 glow-amber',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'glass', padding = 'md', hover = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl',
          variantStyles[variant],
          paddingStyles[padding],
          hover && 'transition-all duration-200 hover:bg-surface-hover hover:border-border-hover hover:shadow-elevated',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

export { Card, type CardProps, type CardVariant, type CardPadding };
