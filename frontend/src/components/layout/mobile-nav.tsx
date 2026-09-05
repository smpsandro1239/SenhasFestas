'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import {
  HomeIcon,
  ClipboardIcon,
  ChefHatIcon,
  CashIcon,
  WalletIcon,
  QrIcon,
  LogoutIcon,
} from '@/components/ui/icons';

export function MobileNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isStaff = !!user?.role && user.role !== 'client';

  const items = [
    { href: '/', label: 'Início', icon: HomeIcon },
    { href: '/pedidos', label: 'Pedidos', icon: ClipboardIcon, staffOnly: true },
    { href: '/cozinha', label: 'Cozinha', icon: ChefHatIcon, staffOnly: true },
    { href: '/saldo', label: 'Saldo', icon: WalletIcon },
    { href: '/qr-order', label: 'Menu', icon: QrIcon },
  ].filter((item) => !item.staffOnly || isStaff);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-surface-solid/80 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && item.href !== '/saldo' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                active ? 'text-brand' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-zinc-500 hover:text-red-400"
        >
          <LogoutIcon className="h-5 w-5" />
          Sair
        </button>
      </div>
    </nav>
  );
}