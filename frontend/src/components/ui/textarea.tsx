import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-zinc-400">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full bg-surface-solid border rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600',
            'transition-all duration-200 resize-none',
            'focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            error
              ? 'border-red-500/40 focus:ring-red-500/30'
              : 'border-border hover:border-border-hover',
            className,
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

export { Textarea, type TextareaProps };
