'use client';

import { useState } from 'react';
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
  WalletIcon,
  QrIcon,
  TvIcon,
  SettingsIcon,
  MenuIcon,
  CloseIcon,
  LogoutIcon,
} from '@/components/ui/icons';

const getNavItems = (role?: string) => {
  const isStaff = !!role && role !== 'client';
  const isSuperadmin = role === 'superadmin';

  return [
    { href: '/', label: 'Início', icon: HomeIcon },
    { href: '/pedidos', label: 'Pedidos', icon: ClipboardIcon },
    { href: '/cozinha', label: 'Cozinha', icon: ChefHatIcon, roles: ['superadmin', 'organizer', 'kitchen', 'bar'] },
    { href: '/caixa', label: 'Caixa', icon: CashIcon, staffOnly: true },
    { href: '/relatorios', label: 'Relatórios', icon: ChartIcon, staffOnly: true },
    { href: '/saldo', label: 'Saldo', icon: WalletIcon },
    { href: '/qr-order', label: 'Menu QR', icon: QrIcon },
    { href: '/publico', label: 'Ecrã Público', icon: TvIcon, staffOnly: true },
    { href: '/admin', label: 'Admin', icon: SettingsIcon, superadminOnly: true },
  ].filter((item) => {
    if (item.roles && !item.roles.includes(role ?? '')) return false;
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

// Bottom bar: 4 fixed slots + "Mais" button. Rest goes into the drawer.
const PRIMARY_HREFS = ['/', '/pedidos', '/saldo', '/qr-order'];

export function MobileNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const items = getNavItems(user?.role);

  // Role-aware primary slots: kitchen/bar/cozinha users get Cozinha in the bar
  // instead of Saldo, since it is their main screen.
  const primary = items.filter((i) => PRIMARY_HREFS.includes(i.href)).slice(0, 4);
  if (
    (user?.role === 'kitchen' || user?.role === 'bar') &&
    items.some((i) => i.href === '/cozinha')
  ) {
    primary[primary.findIndex((i) => i.href === '/saldo')] = items.find((i) => i.href === '/cozinha')!;
  }
  const drawerItems = items.filter((i) => !primary.some((p) => p.href === i.href));

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-surface-solid/80 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                  isActive(item.href) ? 'text-brand-light' : 'text-zinc-400 hover:text-zinc-300',
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-zinc-400 hover:text-zinc-300"
          >
            <MenuIcon className="h-5 w-5" />
            Mais
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface-solid/95 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand to-brand-hover border border-brand-light/40 flex items-center justify-center text-sm font-bold text-black">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-200 truncate">{user?.name}</div>
                  {user?.role && (
                    <Badge variant="neutral" size="sm">{roleLabel[user.role] || user.role}</Badge>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface transition-colors"
                aria-label="Fechar menu"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {drawerItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors border',
                      isActive(item.href)
                        ? 'gradient-brand-soft text-amber-200 border-amber-300/25'
                        : 'text-zinc-300 border-border hover:bg-surface',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="px-5 pb-6">
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
              >
                <LogoutIcon className="h-[18px] w-[18px]" />
                Terminar sessão
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}