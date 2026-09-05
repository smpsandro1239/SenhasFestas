import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  inputSize?: 'md' | 'lg';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, inputSize = 'md', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-zinc-400"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-surface-solid border rounded-xl text-zinc-100 placeholder-zinc-600',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error
                ? 'border-red-500/40 focus:ring-red-500/30 focus:border-red-500/40'
                : 'border-border hover:border-border-hover',
              icon ? 'pl-10' : 'pl-4',
              inputSize === 'lg' ? 'px-4 py-3.5 text-base' : 'px-4 py-2.5 text-sm',
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {hint && !error && <p className="text-sm text-zinc-500">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input, type InputProps };
