'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import {
  HomeIcon,
  ClipboardIcon,
  ChefHatIcon,
  CashIcon,
  ChartIcon,
  SettingsIcon,
  WalletIcon,
  TvIcon,
  QrIcon,
  LogoutIcon,
} from '@/components/ui/icons';

interface SidebarProps {
  className?: string;
}

const getNavItems = (role?: string) => {
  const isStaff = !!role && role !== 'client';
  const isSuperadmin = role === 'superadmin';

  return [
    { href: '/', label: 'Início', icon: HomeIcon },
    { href: '/pedidos', label: 'Pedidos', icon: ClipboardIcon, staffOnly: true },
    { href: '/cozinha', label: 'Cozinha', icon: ChefHatIcon, roles: ['superadmin', 'organizer', 'kitchen', 'bar'] },
    { href: '/caixa', label: 'Caixa', icon: CashIcon, staffOnly: true },
    { href: '/relatorios', label: 'Relatórios', icon: ChartIcon, staffOnly: true },
    { href: '/saldo', label: 'Saldo', icon: WalletIcon },
    { href: '/qr-order', label: 'Menu QR', icon: QrIcon },
    { href: '/publico', label: 'Ecrã Público', icon: TvIcon, staffOnly: true },
    { href: '/admin', label: 'Admin', icon: SettingsIcon, superadminOnly: true },
  ].filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    if (item.staffOnly && !isStaff) return false;
    if (item.superadminOnly && !isSuperadmin) return false;
    return true;
  });
};

const roleLabel: Record<string, string> = {
  superadmin: 'Superadmin',
  organizer: 'Organizador',
  cashier: 'Operador de Caixa',
  bar: 'Bar',
  kitchen: 'Cozinha',
  treasurer: 'Tesoureiro',
  client: 'Cliente',
};

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const items = getNavItems(user?.role);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-60 hidden lg:flex flex-col',
        'bg-surface-solid/60 backdrop-blur-xl border-r border-border',
        className,
      )}
    >
      {/* Brand */}
      <div className="px-6 py-6 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center glow-amber">
            <span className="text-lg">🍷</span>
          </div>
          <div>
            <div className="font-bold text-zinc-50 tracking-tight">SenhasFestas</div>
            <div className="text-[11px] text-zinc-500">Gestão de festas</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-brand/10 text-brand border border-brand/20'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-surface',
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/30 flex items-center justify-center text-sm font-bold text-brand">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-zinc-200 truncate">{user?.name}</div>
            {user?.role && (
              <Badge variant="neutral" size="sm" className="mt-0.5">{roleLabel[user.role] || user.role}</Badge>
            )}
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-surface transition-colors"
            title="Terminar sessão"
          >
            <LogoutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}