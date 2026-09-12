import { cn } from '@/lib/cn';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="absolute top-[10%] right-[-15%] w-[50%] h-[50%] rounded-full bg-fuchsia-500/10 blur-[130px]" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[70%] h-[70%] rounded-full bg-violet-500/10 blur-[140px]" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4 py-8 animate-slide-up">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl gradient-brand-soft border border-amber-300/30 glow-fest mb-4">
            <span className="text-lg font-black tracking-tight text-gradient">SF</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient">
            SenhasFestas
          </h1>
          <p className="mt-2 text-zinc-500">{subtitle}</p>
        </div>

        <div className="glass-strong p-6 sm:p-8 shadow-elevated">
          {title && (
            <h2 className={cn('text-xl font-semibold text-zinc-50 mb-6', !subtitle && 'mt-2')}>
              {title}
            </h2>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}

export default AuthLayout;