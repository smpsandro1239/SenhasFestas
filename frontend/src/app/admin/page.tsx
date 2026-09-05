'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { SettingsIcon, CalendarIcon, UserIcon, InfoIcon } from '@/components/ui/icons';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('eventos');

  const tabs = [
    { id: 'eventos', label: 'Eventos', icon: <CalendarIcon className="h-4 w-4" /> },
    { id: 'utilizadores', label: 'Utilizadores', icon: <UserIcon className="h-4 w-4" /> },
    { id: 'configuracao', label: 'Configuração', icon: <SettingsIcon className="h-4 w-4" /> },
  ];

  const users = [
    { email: 'admin@senhasfestas.com', role: 'Superadmin', variant: 'brand' as const },
    { email: 'operador@senhasfestas.com', role: 'Operador', variant: 'warning' as const },
    { email: 'cozinha@senhasfestas.com', role: 'Cozinha', variant: 'success' as const },
  ];

  return (
    <>
      <title>Admin - SenhasFestas</title>

      <AppShell>
        <PageHeader
          title="Painel de Administração"
          subtitle="Gerir eventos, utilizadores e configurações"
          icon={<SettingsIcon className="h-5 w-5" />}
        />

        <Tabs items={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {activeTab === 'eventos' && (
          <Card>
            <h2 className="text-xl font-bold text-zinc-50 mb-2">Eventos</h2>
            <p className="text-zinc-500 mb-6 text-sm">
              Gerir eventos, criar novos, editar datas e fechar eventos.
            </p>

            <Card hover className="bg-surface/50 border-border-hover glow-amber">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-100">
                      Festa de Aldeia - Agosto 2026
                    </div>
                    <div className="text-sm text-zinc-500 mt-1">
                      Local: Praça Central • Organizador: Junta de Freguesia
                    </div>
                  </div>
                </div>
                <Badge variant="success" dot>Ativo</Badge>
              </div>
            </Card>
          </Card>
        )}

        {activeTab === 'utilizadores' && (
          <Card>
            <h2 className="text-xl font-bold text-zinc-50 mb-2">Utilizadores</h2>
            <p className="text-zinc-500 mb-6 text-sm">Gerir perfis e permissões dos utilizadores do evento.</p>

            <div className="space-y-3">
              {users.map((user, idx) => (
                <Card
                  key={user.email}
                  hover
                  padding="sm"
                  className={`flex items-center justify-between bg-surface/50 animate-fade-in stagger-${idx + 1}`}
                >
                  <span className="flex items-center gap-3 text-zinc-200">
                    <span className="h-8 w-8 rounded-full bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/30 flex items-center justify-center text-xs font-bold text-brand">
                      {user.email.charAt(0).toUpperCase()}
                    </span>
                    {user.email}
                  </span>
                  <Badge variant={user.variant}>{user.role}</Badge>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'configuracao' && (
          <Card>
            <h2 className="text-xl font-bold text-zinc-50 mb-2">Configuração</h2>
            <p className="text-zinc-500 mb-6 text-sm">Configurar moeda, impostos e regras do evento.</p>

            <div className="space-y-3 max-w-lg">
              {[
                { label: 'Moeda', value: '€ EUR', icon: <CalendarIcon className="h-4 w-4" /> },
                { label: 'IVA', value: '6%', icon: <InfoIcon className="h-4 w-4" /> },
                { label: 'Pagamento', value: 'Numerário • MB Way • Saldo', icon: <SettingsIcon className="h-4 w-4" /> },
              ].map((field) => (
                <Card key={field.label} padding="sm" className="flex items-center justify-between bg-surface/50">
                  <span className="flex items-center gap-3 text-zinc-400">
                    {field.icon}
                    {field.label}
                  </span>
                  <span className="font-medium text-zinc-100">{field.value}</span>
                </Card>
              ))}
            </div>
          </Card>
        )}
      </AppShell>
    </>
  );
}