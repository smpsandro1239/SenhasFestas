import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  inputSize?: 'md' | 'lg';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, inputSize = 'md', id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const feedbackId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
    const describedBy = [ariaDescribedBy, feedbackId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : ariaInvalid}
            aria-describedby={describedBy}
            className={cn(
              'w-full min-h-11 bg-surface-solid border rounded-xl text-zinc-100 placeholder-zinc-500',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error
                ? 'border-red-500/40 focus:ring-red-500/30 focus:border-red-500/40'
                : 'border-border hover:border-border-hover',
              inputSize === 'lg' ? 'min-h-12 py-3.5 text-base' : 'py-2.5 text-sm',
              icon ? 'pl-10 pr-4' : 'px-4',
              className,
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-sm text-zinc-300">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input, type InputProps };
