'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { CashIcon } from '@/components/ui/icons';
import { useAuth } from '@/lib/auth-context';
import { useCurrentEvent } from '@/lib/use-current-event';
import { getOpenCash, openCash, closeCash, getCashByEvent, getUsers, loadBalance, getBalance, reverseLoad } from '@/lib/api';

function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEuro(value: number): string {
  return Number(value).toFixed(2);
}

function CaixaPage() {
  const { user } = useAuth();
  const { event, error: eventError } = useCurrentEvent();
  const [activeTab, setActiveTab] = useState('fecho');
  const [caixaAberta, setCaixaAberta] = useState<any>(null);
  const [formData, setFormData] = useState({ valorInicial: '', observacoes: '' });
  const [fechoData, setFechoData] = useState({ totalReal: '', observacoes: '' });
  const [movements, setMovements] = useState<any[]>([]);
  const [movementList, setMovementList] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(eventError);
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loadAmount, setLoadAmount] = useState('');
  const [userBalance, setUserBalance] = useState<number | null>(null);

  const carregarCaixaAberta = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    setError('');
    try {
      const data = await getOpenCash(event.id);
      setCaixaAberta(data && data.id ? {
        id: data.id,
        operador: user?.name ?? '',
        evento: event.name,
        abertoEm: formatDateTime(data.openedAt),
        valorInicial: Number(data.openingBalance || 0),
      } : null);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar estado do caixa');
    } finally {
      setLoading(false);
    }
  }, [event, user?.name]);

  const fecharCaixa = async () => {
    if (!caixaAberta) return;
    setLoading(true);
    setError('');
    setSuccess('');

    const totalReal = parseFloat(fechoData.totalReal);
    if (isNaN(totalReal) || totalReal < 0) {
      setError('Por favor, insira um valor válido para o total em caixa');
      setLoading(false);
      return;
    }

    try {
      await closeCash(caixaAberta.id, {
        totalActual: totalReal,
        notes: fechoData.observacoes || undefined,
      });
      setSuccess('Caixa fechado com sucesso!');
      setFechoData({ totalReal: '', observacoes: '' });
      setCaixaAberta(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao fechar o caixa');
    } finally {
      setLoading(false);
    }
  };

  const abrirCaixa = async () => {
    if (!event) return;
    setLoading(true);
    setError('');
    setSuccess('');

    const valorInicial = parseFloat(formData.valorInicial);
    if (isNaN(valorInicial) || valorInicial < 0) {
      setError('Por favor, insira um valor válido para o valor inicial');
      setLoading(false);
      return;
    }

    try {
      await openCash({
        eventId: event.id,
        openingBalance: valorInicial,
        notes: formData.observacoes || undefined,
      });
      setSuccess('Caixa aberto com sucesso!');
      setFormData({ valorInicial: '', observacoes: '' });
      await carregarCaixaAberta();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao abrir o caixa');
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = useCallback(async () => {
    if (!event) return;
    try {
      const list = await getCashByEvent(event.id);
      setMovements(
        list
          .filter((c) => c.status === 'closed')
          .map((c) => ({
            hora: formatDateTime(c.openedAt),
            tipo: 'Entrada',
            valor: `+€${formatEuro(c.closingBalance ?? 0)}`,
            operador: user?.name ?? '',
            obs: c.notes ?? '',
          })),
      );
      setHistory(
        list.map((c) => ({
          numero: `#${c.id?.slice(0, 8) ?? '000'}`,
          status: c.status === 'closed' ? 'Fechado' : 'Aberto',
          desc: `${formatDateTime(c.openedAt)} • Início: €${formatEuro(c.openingBalance || 0)}`,
          variant: c.status === 'closed' ? ('success' as const) : ('primary' as const),
        })),
      );
    } catch {
      setMovements([]);
      setHistory([]);
    }
  }, [event, user?.name]);

  const pesquisarUtilizadores = async (q: string) => {
    try {
      const list = await getUsers(q);
      setUsers(Array.isArray(list) ? list.filter((u) => u.role === 'client') : []);
    } catch {
      setUsers([]);
    }
  };

  const selecionarUtilizador = async (u: any) => {
    setSelectedUser(u);
    setUserSearch(u.name);
    setUsers([]);
    setUserBalance(null);
    if (!event) return;
    try {
      const b = await getBalance(u.id, event.id);
      setUserBalance(Number(b?.balance ?? 0));
      setMovementList(Array.isArray(b?.movements) ? b.movements.filter((x) => x.type === 'load') : []);
    } catch {
      setUserBalance(0);
      setMovementList([]);
    }
  };

  const estornarMovimento = async (movimento: any) => {
    if (!selectedUser || !event) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await reverseLoad(selectedUser.id, movimento.id, event.id);
      const b = await getBalance(selectedUser.id, event.id);
      setUserBalance(Number(b?.balance ?? 0));
      setMovementList(Array.isArray(b?.movements) ? b.movements.filter((x) => x.type === 'load') : []);
      setSuccess(
        `Carregamento de €${formatEuro(Math.abs(Number(movimento.amount ?? 0)))} estornado para ${selectedUser.name}`,
      );
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao estornar carregamento');
    } finally {
      setLoading(false);
    }
  };

  const carregarSaldo = async () => {
    if (!selectedUser || !event) return;
    const valor = parseFloat(loadAmount);
    if (isNaN(valor) || valor <= 0) {
      setError('Insira um valor válido para carregar');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await loadBalance(selectedUser.id, valor, event.id);
      const b = await getBalance(selectedUser.id, event.id);
      setUserBalance(Number(b?.balance ?? 0));
      setLoadAmount('');
      setSuccess(`Saldo carregado: +€${valor.toFixed(2)} para ${selectedUser.name}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar saldo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (event) {
      setError('');
      carregarCaixaAberta();
      carregarHistorico();
    }
  }, [event, carregarCaixaAberta, carregarHistorico]);

  const tabs = [
    { id: 'fecho', label: 'Fecho de Caixa' },
    { id: 'saldo', label: 'Carregar Saldo' },
    { id: 'movimentacoes', label: 'Movimentações' },
    { id: 'historico', label: 'Histórico' },
  ];

  return (
    <>
      <title>Fecho de Caixa - SenhasFestas</title>

      <AppShell>
        <PageHeader
          title="Fecho de Caixa"
          subtitle="Gestão do caixa do evento"
          icon={<CashIcon className="h-5 w-5" />}
        />

        <Tabs items={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {activeTab === 'fecho' && (
          <Card className="max-w-3xl">
            {!caixaAberta ? (
              <div>
                <h2 className="text-xl font-bold text-zinc-50 mb-6">Abrir Caixa</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    abrirCaixa();
                  }}
                  className="space-y-4 max-w-md"
                >
                  <Input
                    label="Valor Inicial (€)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.valorInicial}
                    onChange={(e) => setFormData({ ...formData, valorInicial: e.target.value })}
                    placeholder="Ex: 50.00"
                    required
                  />
                  <Textarea
                    label="Observações (opcional)"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={3}
                    placeholder="Observações sobre o fundo de troco..."
                  />
                  <Button type="submit" loading={loading} variant="success" className="w-full" size="lg">
                    {loading ? 'A abrir...' : 'Abrir Caixa'}
                  </Button>
                </form>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-zinc-50 mb-6">Caixa Aberto</h2>
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Operador', value: caixaAberta.operador },
                      { label: 'Evento', value: caixaAberta.evento },
                      { label: 'Aberto em', value: caixaAberta.abertoEm },
                    ].map((field) => (
                      <Card key={field.label} padding="sm" className="bg-surface/50">
                        <div className="text-xs text-zinc-500">{field.label}</div>
                        <div className="font-semibold text-zinc-100">{field.value}</div>
                      </Card>
                    ))}
                    <Card padding="sm" className="bg-emerald-500/5 border-emerald-500/20">
                      <div className="text-xs text-zinc-500">Valor Inicial</div>
                      <div className="font-bold text-emerald-400">€{caixaAberta.valorInicial.toFixed(2)}</div>
                    </Card>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-zinc-100 mb-4">Fechar Caixa</h3>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        fecharCaixa();
                      }}
                      className="space-y-4"
                    >
                      <Input
                        label="Total em Caixa (€)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={fechoData.totalReal}
                        onChange={(e) => setFechoData({ ...fechoData, totalReal: e.target.value })}
                        placeholder="Ex: 425.50"
                        required
                      />
                      <Textarea
                        label="Observações (opcional)"
                        value={fechoData.observacoes}
                        onChange={(e) => setFechoData({ ...fechoData, observacoes: e.target.value })}
                        rows={3}
                        placeholder="Observações sobre o fechamento..."
                      />
                      <Button type="submit" loading={loading} variant="danger" className="w-full" size="lg">
                        {loading ? 'A fechar...' : 'Fechar Caixa'}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {success && <div className="mt-4"><Alert variant="success" message={success} /></div>}
            {error && <div className="mt-4"><Alert variant="error" message={error} /></div>}
          </Card>
        )}

        {activeTab === 'saldo' && (
          <Card className="max-w-3xl">
            <h2 className="text-xl font-bold text-zinc-50 mb-1">Carregar Saldo a Cliente</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Procure o cliente, registe o valor recebido e carregue o saldo.
            </p>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Procurar cliente (nome ou email)
                </label>
                <Input
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setSelectedUser(null);
                    if (e.target.value.length >= 2) pesquisarUtilizadores(e.target.value);
                  }}
                  placeholder="Nome ou email do cliente"
                />
                {users.length > 0 && !selectedUser && (
                  <div className="mt-2 border border-border rounded-xl overflow-hidden bg-surface-solid">
                    {users.slice(0, 6).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => selecionarUtilizador(u)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-surface transition-colors border-b border-border/50 last:border-b-0"
                      >
                        <span className="text-zinc-100">{u.name}</span>
                        <span className="text-zinc-500 text-xs">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface border border-border">
                  <span>
                    <span className="block font-medium text-zinc-100">{selectedUser.name}</span>
                    <span className="block text-xs text-zinc-500">{selectedUser.email}</span>
                  </span>
                  <span className="text-sm">
                    Saldo: <span className="font-bold text-emerald-400">€{userBalance?.toFixed(2) ?? '0.00'}</span>
                  </span>
                </div>
              )}

              {selectedUser && (
                <>
                  <Input
                    label="Valor a carregar (€)"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={loadAmount}
                    onChange={(e) => setLoadAmount(e.target.value)}
                    placeholder="10.00"
                    required
                  />
                  <Button type="button" onClick={carregarSaldo} loading={loading} variant="success" className="w-full" size="lg">
                    {loading ? 'A carregar...' : 'Confirmar Carregamento'}
                  </Button>
                </>
              )}

              {success && <div className="mt-4"><Alert variant="success" message={success} /></div>}
              {error && <div className="mt-4"><Alert variant="error" message={error} /></div>}

              {selectedUser && movementList.length > 0 && (
                <div className="pt-4 mt-4 border-t border-border/50">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-2">Carregamentos recentes</h3>
                  <div className="space-y-2">
                    {movementList.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface/50 border border-border text-sm"
                      >
                        <span className="flex items-center gap-3">
                          <span className="text-emerald-400 font-mono font-semibold">
                            +€{formatEuro(Math.abs(Number(m.amount ?? 0)))}
                          </span>
                          <span className="text-zinc-500 text-xs">
                            {m.date ? formatDateTime(typeof m.date === 'string' ? m.date : new Date(m.date)) : ''}
                          </span>
                          {m.reversed && <Badge variant="warning" size="sm">Estornado</Badge>}
                        </span>
                        {!m.reversed && (
                          <button
                            type="button"
                            onClick={() => estornarMovimento(m)}
                            disabled={loading}
                            className="text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50"
                          >
                            Estornar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'movimentacoes' && (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface/70 border-b border-border">
                    {['Hora', 'Tipo', 'Valor', 'Operador', 'Observação'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m, idx) => (
                    <tr key={idx} className="border-b border-border/50 last:border-0 hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 text-zinc-400">{m.hora}</td>
                      <td className="px-4 py-3 font-medium">
                        <span className={m.tipo === 'Entrada' ? 'text-emerald-400' : 'text-red-400'}>{m.tipo}</span>
                      </td>
                      <td className={`px-4 py-3 font-mono font-semibold ${m.tipo === 'Entrada' ? 'text-emerald-400' : 'text-red-400'}`}>{m.valor}</td>
                      <td className="px-4 py-3 text-zinc-300">{m.operador}</td>
                      <td className="px-4 py-3 text-zinc-500">{m.obs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'historico' && (
          <div className="space-y-3 max-w-2xl">
            {history.map((h) => (
              <Card key={h.numero} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-zinc-100">Fechamento {h.numero}</div>
                  <div className="text-sm text-zinc-500 mt-0.5">{h.desc}</div>
                </div>
                <Badge variant={h.variant} dot>{h.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </AppShell>
    </>
  );
}

export default function CaixaPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CaixaPage />
    </Suspense>
  );
}