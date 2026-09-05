'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserIcon, LogoutIcon } from '@/components/ui/icons';

const roleLabel: Record<string, string> = {
  superadmin: 'Superadmin',
  organizer: 'Organizador',
  cashier: 'Operador de Caixa',
  bar: 'Bar',
  kitchen: 'Cozinha',
  treasurer: 'Tesoureiro',
  client: 'Cliente',
};

export default function PerfilPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <>
      <title>Perfil - SenhasFestas</title>

      <AppShell>
        <PageHeader
          title="O seu Perfil"
          subtitle="Informações da sua conta"
          icon={<UserIcon className="h-5 w-5" />}
        />

        <Card className="max-w-2xl overflow-hidden">
          <div className="border-b border-border bg-gradient-to-r from-brand/5 via-transparent to-transparent p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/30 flex items-center justify-center text-2xl font-bold text-brand glow-amber">
                {(user.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-50">{user.name}</h2>
                <p className="text-sm text-zinc-500">{user.email}</p>
                {user.role && (
                  <div className="mt-1.5">
                    <Badge variant="brand">{roleLabel[user.role] || user.role}</Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            <dl className="space-y-3">
              {[
                { label: 'Nome', value: user.name },
                { label: 'Email', value: user.email },
                { label: 'Telefone', value: user.phone || '—' },
                { label: 'Estado', value: user.isActive ? 'Ativo' : 'Inativo' },
              ].map((field) => (
                <div key={field.label} className="flex items-center justify-between py-2">
                  <dt className="text-sm text-zinc-500">{field.label}</dt>
                  <dd className="text-sm font-medium text-zinc-200">{field.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 pt-6 border-t border-border">
              <Button variant="danger" onClick={handleLogout} icon={<LogoutIcon className="h-4 w-4" />}>
                Terminar Sessão
              </Button>
            </div>
          </div>
        </Card>
      </AppShell>
    </>
  );
}