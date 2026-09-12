'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { SettingsIcon, CalendarIcon, UserIcon, ClipboardIcon, ShieldCheckIcon } from '@/components/ui/icons';
import { getEvents, createEvent, getUsers, getProducts, createProduct, updateProduct, getEventMembers, addEventMember, removeEventMember, getAudit, exportAuditCsv, getEventSettings, updateEventSettings } from '@/lib/api';
import { downloadTextFile } from '@/lib/download';

const roleVariant: Record<string, 'brand' | 'warning' | 'success'> = {
  superadmin: 'brand',
  organizer: 'warning',
  cashier: 'success',
  bar: 'success',
  kitchen: 'success',
  treasurer: 'success',
  client: 'warning',
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('eventos');
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [memberEventId, setMemberEventId] = useState('');
  const [memberRole, setMemberRole] = useState('client');
  const [memberTarget, setMemberTarget] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
  });
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    availability: 'available',
    stock: '',
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [settingsEventId, setSettingsEventId] = useState('');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const tabs = [
    { id: 'eventos', label: 'Eventos', icon: <CalendarIcon className="h-4 w-4" /> },
    { id: 'produtos', label: 'Produtos', icon: <ClipboardIcon className="h-4 w-4" /> },
    { id: 'utilizadores', label: 'Utilizadores', icon: <UserIcon className="h-4 w-4" /> },
    { id: 'configuracao', label: 'Configuração', icon: <SettingsIcon className="h-4 w-4" /> },
    { id: 'auditoria', label: 'Auditoria', icon: <ShieldCheckIcon className="h-4 w-4" /> },
  ];

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getEvents();
      setEvents(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar utilizadores');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (eventId: string) => {
    setLoading(true);
    setError('');
    try {
      const list = await getEventMembers(eventId);
      setMembers(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar membros do evento');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!memberEventId) return;
    setLoading(true);
    setError('');
    try {
      await addEventMember(memberEventId, userId, memberRole);
      await loadMembers(memberEventId);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao associar utilizador ao evento');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!memberEventId) return;
    setLoading(true);
    setError('');
    try {
      await removeEventMember(memberEventId, userId);
      await loadMembers(memberEventId);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao remover utilizador do evento');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProducts();
      setProducts(Array.isArray(data) ? data : data?.items ?? []);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(productForm.price);
    if (!productForm.name || isNaN(price) || price < 0) {
      setError('Preencha o nome e um preço válido');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createProduct({
        name: productForm.name,
        description: productForm.description || undefined,
        price,
        availability: productForm.availability,
        stock: productForm.stock ? parseFloat(productForm.stock) : undefined,
      });
      setProductForm({ name: '', description: '', price: '', availability: 'available', stock: '' });
      await loadProducts();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar produto');
    } finally {
      setLoading(false);
    }
  };

  const toggleProductAvailability = async (product: any) => {
    const next = product.availability === 'available' ? 'unavailable' : 'available';
    setLoading(true);
    setError('');
    try {
      await updateProduct(product.id, { availability: next });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, availability: next } : p)),
      );
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar produto');
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    setError('');
    try {
      const data = await getAudit({ page: 1, limit: 50 });
      setAuditLogs(Array.isArray(data) ? data : data?.items ?? []);
      setAuditTotal(data?.total ?? 0);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar auditoria');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExportAudit = async () => {
    setError('');
    try {
      const csv = await exportAuditCsv();
      downloadTextFile('auditoria.csv', csv);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao exportar auditoria');
    }
  };

  const loadSettings = async (eventId: string) => {
    setSettingsLoading(true);
    setError('');
    setSettingsSaved(false);
    try {
      const settingsData = await getEventSettings(eventId);
      setSettings(settingsData ?? {});
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar configuração');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsEventId) return;
    setSettingsLoading(true);
    setError('');
    setSettingsSaved(false);
    try {
      const taxRate = settings.taxRate === undefined || settings.taxRate === '' ? undefined : Number(settings.taxRate) / 100;
      const payload: Record<string, unknown> = {
        currency: settings.currency ?? 'EUR',
        taxRate,
        serviceCharge:
          settings.serviceCharge === undefined || settings.serviceCharge === ''
            ? undefined
            : Number(settings.serviceCharge),
        requireBalance: Boolean(settings.requireBalance),
        allowOffline: Boolean(settings.allowOffline),
      };
      await updateEventSettings(settingsEventId, payload);
      setSettingsSaved(true);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao guardar configuração');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'eventos') loadEvents();
    if (activeTab === 'utilizadores') {
      loadUsers();
      loadEvents();
    }
    if (activeTab === 'produtos') loadProducts();
    if (activeTab === 'auditoria') loadAudit();
    if (activeTab === 'configuracao') loadEvents();
  }, [activeTab]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate || !formData.endDate) {
      setError('Preencha nome e datas do evento');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createEvent({
        name: formData.name,
        location: formData.location || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
      });
      setFormData({ name: '', location: '', startDate: '', endDate: '' });
      await loadEvents();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar evento');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Eventos</h2>
              <p className="text-zinc-500 mb-6 text-sm">
                Gerir eventos, criar novos, editar datas e fechar eventos.
              </p>

              {loading && events.length === 0 ? null : events.length === 0 ? (
                <div className="text-sm text-zinc-500 py-4">Nenhum evento criado ainda.</div>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <Card key={event.id} hover className="bg-surface/50 border-border-hover">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand">
                            <CalendarIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-100">{event.name}</div>
                            <div className="text-sm text-zinc-500 mt-1">
                              {event.location || 'Local não definido'} •{' '}
                              {new Date(event.startDate).toLocaleDateString('pt-PT')} a{' '}
                              {new Date(event.endDate).toLocaleDateString('pt-PT')}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            event.status === 'active'
                              ? 'success'
                              : event.status === 'draft'
                                ? 'warning'
                                : 'danger'
                          }
                          dot
                        >
                          {event.status === 'active' ? 'Ativo' : event.status === 'draft' ? 'Rascunho' : 'Fechado'}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-4">Criar Evento</h2>
              <form onSubmit={handleCreateEvent} className="space-y-4 max-w-lg">
                <Input
                  label="Nome do evento"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Festa de Aldeia - Agosto 2026"
                  required
                />
                <Input
                  label="Local"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Praça Central"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Início"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                  <Input
                    label="Fim"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" loading={loading}>
                  {loading ? 'A criar...' : 'Criar Evento'}
                </Button>
              </form>
            </Card>
          </div>
        )}

        {activeTab === 'utilizadores' && (
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Utilizadores</h2>
              <p className="text-zinc-500 mb-6 text-sm">Gerir perfis e permissões dos utilizadores do evento.</p>

              {users.length === 0 && !loading ? (
                <div className="text-sm text-zinc-500 py-4">Nenhum utilizador encontrado.</div>
              ) : (
                <div className="space-y-3">
                  {users.map((user, idx) => (
                    <Card
                      key={user.id}
                      hover
                      padding="sm"
                      className={`flex items-center justify-between bg-surface/50 animate-fade-in stagger-${idx + 1}`}
                    >
                      <span className="flex items-center gap-3 text-zinc-200">
                        <span className="h-8 w-8 rounded-full bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/30 flex items-center justify-center text-xs font-bold text-brand">
                          {(user.name || user.email || '?').charAt(0).toUpperCase()}
                        </span>
                        <span>
                          <span className="block">{user.name}</span>
                          <span className="block text-xs text-zinc-500">{user.email}</span>
                        </span>
                      </span>
                      <Badge variant={roleVariant[user.role] ?? 'warning'}>{user.role}</Badge>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Associar ao Evento</h2>
              <p className="text-zinc-500 mb-6 text-sm">
                Associe utilizadores a um evento para terem acesso ao menu, caixa e relatórios.
              </p>

              <div className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-400">Evento</label>
                  <select
                    value={memberEventId}
                    onChange={(e) => {
                      setMemberEventId(e.target.value);
                      setMembers([]);
                      if (e.target.value) loadMembers(e.target.value);
                    }}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="">Selecionar evento...</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>

                {memberEventId && (
                  <>
                    <div className="flex items-center gap-3">
                      <select
                        value={memberTarget}
                        onChange={(e) => setMemberTarget(e.target.value)}
                        className="flex-1 bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                      >
                        <option value="">Selecionar utilizador...</option>
                        {users
                          .filter((u) => !members.some((m) => m.userId === u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                      </select>
                      <select
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value)}
                        className="bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                      >
                        <option value="client">Cliente</option>
                        <option value="bar">Bar</option>
                        <option value="kitchen">Cozinha</option>
                        <option value="cashier">Caixa</option>
                        <option value="treasurer">Tesoureiro</option>
                        <option value="organizer">Organizador</option>
                      </select>
                      <Button
                        type="button"
                        onClick={() => handleAddMember(memberTarget)}
                        disabled={!memberTarget}
                      >
                        Associar
                      </Button>
                    </div>

                    <div className="space-y-2 pt-2">
                      {members.length === 0 ? (
                        <div className="text-sm text-zinc-500">Nenhum membro associado a este evento.</div>
                      ) : (
                        members.map((m) => (
                          <Card key={m.id} padding="sm" className="flex items-center justify-between bg-surface/50">
                            <span className="flex items-center gap-3 text-zinc-200">
                              <span className="h-8 w-8 rounded-full bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/30 flex items-center justify-center text-xs font-bold text-brand">
                                {(m.name || m.email || '?').charAt(0).toUpperCase()}
                              </span>
                              <span>
                                <span className="block">{m.name}</span>
                                <span className="block text-xs text-zinc-500">{m.email}</span>
                              </span>
                            </span>
                            <span className="flex items-center gap-3">
                              <Badge variant={roleVariant[m.role] ?? 'warning'}>{m.role}</Badge>
                              <Button variant="danger" size="sm" onClick={() => handleRemoveMember(m.userId)}>
                                Remover
                              </Button>
                            </span>
                          </Card>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'produtos' && (
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Produtos</h2>
              <p className="text-zinc-500 mb-6 text-sm">
                Catálogo de produtos e preços do evento.
              </p>

              {loading && products.length === 0 ? null : products.length === 0 ? (
                <div className="text-sm text-zinc-500 py-4">Nenhum produto criado ainda.</div>
              ) : (
                <div className="space-y-3">
                  {products.map((product) => (
                    <Card key={product.id} hover className="bg-surface/50 border-border-hover">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-semibold text-zinc-100">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-zinc-500 mt-1">{product.description}</div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="success">€{Number(product.price).toFixed(2)}</Badge>
                            <Badge
                              variant={
                                product.availability === 'available'
                                  ? 'success'
                                  : product.availability === 'limited'
                                    ? 'warning'
                                    : 'danger'
                              }
                            >
                              {product.availability === 'available'
                                ? 'Disponível'
                                : product.availability === 'limited'
                                  ? 'Limitado'
                                  : 'Indisponível'}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant={product.availability === 'available' ? 'danger' : 'success'}
                          size="sm"
                          onClick={() => toggleProductAvailability(product)}
                          disabled={loading}
                        >
                          {product.availability === 'available' ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-4">Criar Produto</h2>
              <form onSubmit={handleCreateProduct} className="space-y-4 max-w-lg">
                <Input
                  label="Nome do produto"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Bifana"
                  required
                />
                <Textarea
                  label="Descrição (opcional)"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={3}
                  placeholder="Pão, carne e molho da casa..."
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Preço (€)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="3.50"
                    required
                  />
                  <Input
                    label="Stock (opcional)"
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-400">Disponibilidade</label>
                  <select
                    value={productForm.availability}
                    onChange={(e) => setProductForm({ ...productForm, availability: e.target.value })}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="available">Disponível</option>
                    <option value="limited">Limitado</option>
                    <option value="unavailable">Indisponível</option>
                  </select>
                </div>
                <Button type="submit" loading={loading}>
                  {loading ? 'A criar...' : 'Criar Produto'}
                </Button>
              </form>
            </Card>
          </div>
        )}

        {activeTab === 'configuracao' && (
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Configuração do Evento</h2>
              <p className="text-zinc-500 mb-6 text-sm">
                Configurar moeda, impostos e regras de um evento. As alterações ficam guardadas na base de dados.
              </p>

              <div className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-400">Evento</label>
                  <select
                    value={settingsEventId}
                    onChange={(e) => {
                      setSettingsEventId(e.target.value);
                      setSettings({});
                      setSettingsSaved(false);
                      if (e.target.value) loadSettings(e.target.value);
                    }}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="">Selecionar evento...</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>

                {settingsEventId && (
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-zinc-400">Moeda</label>
                      <select
                        value={settings.currency ?? 'EUR'}
                        onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                        className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="BRL">BRL (R$)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="IVA (%)"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={
                          settings.taxRate === undefined ? '' : String(Number(settings.taxRate) * 100)
                        }
                        onChange={(e) =>
                          setSettings({ ...settings, taxRate: e.target.value === '' ? '' : Number(e.target.value) / 100 })
                        }
                        placeholder="6"
                      />
                      <Input
                        label="Taxa de serviço"
                        type="number"
                        min="0"
                        step="0.5"
                        value={settings.serviceCharge ?? ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            serviceCharge:
                              e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        placeholder="0.50"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 p-3">
                        <span className="text-sm text-zinc-300">Exigir saldo para pedidos</span>
                        <input
                          type="checkbox"
                          checked={Boolean(settings.requireBalance)}
                          onChange={(e) =>
                            setSettings({ ...settings, requireBalance: e.target.checked })
                          }
                          className="h-4 w-4 accent-brand"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 p-3">
                        <span className="text-sm text-zinc-300">Permitir modo offline</span>
                        <input
                          type="checkbox"
                          checked={Boolean(settings.allowOffline)}
                          onChange={(e) =>
                            setSettings({ ...settings, allowOffline: e.target.checked })
                          }
                          className="h-4 w-4 accent-brand"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button type="submit" loading={settingsLoading}>
                        {settingsLoading ? 'A guardar...' : 'Guardar'}
                      </Button>
                      {settingsSaved && <Badge variant="success">Configuração guardada</Badge>}
                    </div>
                  </form>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'auditoria' && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-50 mb-2">Auditoria</h2>
                  <p className="text-zinc-500 text-sm">
                    Registo imutável de todas as ações (login, carregamentos, cancelamentos, fecho de caixa...).
                    {auditTotal > 0 && (
                      <span className="text-zinc-400"> • {auditTotal} registos (últimos 50)</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={loadAudit} disabled={auditLoading}>
                    Atualizar
                  </Button>
                  <Button size="sm" onClick={handleExportAudit} disabled={auditLoading}>
                    Exportar CSV
                  </Button>
                </div>
              </div>

              {auditLoading && auditLogs.length === 0 ? (
                <div className="text-sm text-zinc-500 py-4">A carregar auditoria...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-sm text-zinc-500 py-4">Nenhum registo de auditoria.</div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <Badge variant="brand">{log.action}</Badge>
                          <span className="text-zinc-300">{log.entity ?? log.resource ?? '—'}</span>
                          {log.entityId && (
                            <span className="font-mono text-xs text-zinc-600">{String(log.entityId).slice(0, 8)}</span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-PT') : '—'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                        <span>
                          por{' '}
                          {log.actorRole
                            ? `${log.actorRole}${log.actorId ? ` · ${String(log.actorId).slice(0, 8)}` : ''}`
                            : log.actorId
                              ? String(log.actorId).slice(0, 8)
                              : 'sistema'}
                        </span>
                        {log.ip && <span>· {log.ip}</span>}
                        <span className="text-zinc-600">· {log.details?.method ?? ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {error && <div className="mt-4"><Alert variant="error" message={error} /></div>}
      </AppShell>
    </>
  );
}