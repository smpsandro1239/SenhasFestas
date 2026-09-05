'use client';

import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { cn } from '@/lib/cn';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function AppShell({ children, className, fullWidth = false }: AppShellProps) {
  return (
    <div className="page-bg min-h-dvh">
      <Sidebar />
      <main
        className={cn(
          'lg:pl-60 min-h-dvh flex flex-col',
          className,
        )}
      >
        <div
          className={cn(
            'flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8',
            !fullWidth && 'max-w-7xl',
            'pb-24 lg:pb-8',
          )}
        >
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}