'use client';

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ChartIcon, CashIcon, WalletIcon, ClipboardIcon, RefreshIcon } from '@/components/ui/icons';
import { getReports, exportOrdensCsv } from '@/lib/api';
import { useCurrentEvent } from '@/lib/use-current-event';
import { cn } from '@/lib/cn';

interface Estatisticas {
  recebidos: number;
  emPreparacao: number;
  prontos: number;
  entregues: number;
  total: number;
}

interface TotalVendas {
  total: number;
  pedidos: number;
}

interface SerieDia {
  dia: string;
  total: string;
  pedidos: string;
}

interface MetodoPagamento {
  metodo: string;
  total: string;
  pedidos: string;
}

interface MovimentoResumo {
  tipo: string;
  total: string;
  quantidade: string;
}

interface OrdemRow {
  id: string;
  createdAt: string;
  status: string;
  source: string;
  tableNumber?: string;
  station?: string;
  total: string;
  paymentMethod: string;
  items?: { quantity: number; product?: { name?: string } | null; subtotal: string }[];
}

type Periodo = 'hoje' | '7d' | '30d' | 'tudo';

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'tudo', label: 'Tudo' },
];

const STATUS_ORDENS: { id: string; label: string }[] = [
  { id: '', label: 'Todos' },
  { id: 'received', label: 'Recebidos' },
  { id: 'preparing', label: 'Em preparação' },
  { id: 'ready', label: 'Prontos' },
  { id: 'delivered', label: 'Entregues' },
  { id: 'cancelled', label: 'Cancelados' },
];

const STATUS_LABEL: Record<string, string> = {
  received: 'Recebido',
  preparing: 'Em preparação',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'brand' | 'success' | 'danger'> = {
  received: 'info',
  preparing: 'warning',
  ready: 'brand',
  delivered: 'success',
  cancelled: 'danger',
};

const METODO_LABEL: Record<string, string> = {
  cash: 'Dinheiro',
  mbway: 'MB Way',
  balance: 'Saldo',
};

const METODO_COLOR: Record<string, string> = {
  cash: 'from-emerald-500/40 to-emerald-400',
  mbway: 'from-blue-500/40 to-blue-400',
  balance: 'from-amber-500/40 to-amber-300',
};

export default function RelatoriosPageWrapper() {
  return (
    <Suspense fallback={null}>
      <RelatoriosPage />
    </Suspense>
  );
}

function periodoRange(periodo: Periodo): { from?: string; to?: string } {
  if (periodo === 'tudo') return {};
  const to = new Date();
  const from = new Date();
  if (periodo === 'hoje') {
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const dias = periodo === '7d' ? 7 : 30;
  from.setDate(from.getDate() - dias);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

// Range anterior com a mesma duração do filtro atual (para comparação de tendência).
function periodoAnteriorRange(periodo: Periodo): { from?: string; to?: string } {
  if (periodo === 'tudo') return {};
  const { from } = periodoRange(periodo);
  if (!from) return {};
  const inicioAtual = new Date(from);
  const diasDiferenca = periodo === 'hoje' ? 1 : periodo === '7d' ? 7 : 30;
  const inicioAnterior = new Date(inicioAtual);
  inicioAnterior.setDate(inicioAnterior.getDate() - diasDiferenca);
  const fimAnterior = new Date(inicioAtual);
  fimAnterior.setMilliseconds(-1);
  return { from: inicioAnterior.toISOString(), to: fimAnterior.toISOString() };
}

function formatRangeLabel(periodo: Periodo, from?: string, to?: string): string {
  if (periodo === 'tudo' || !from || !to) return 'Todo o histórico';
  const f = new Date(from);
  const t = new Date(to);
  const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return `${f.toLocaleDateString('pt-PT', opt)} – ${t.toLocaleDateString('pt-PT', opt)}`;
}

function RelatoriosPage() {
  const { event } = useCurrentEvent();
  const [activeTab, setActiveTab] = useState('visao');
  const [periodo, setPeriodo] = useState<Periodo>('7d');
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [totalVendas, setTotalVendas] = useState<TotalVendas | null>(null);
  const [series, setSeries] = useState<SerieDia[]>([]);
  const [metodos, setMetodos] = useState<MetodoPagamento[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoResumo[]>([]);
  const [topProducts, setTopProducts] = useState<{
    id: string;
    name: string;
    price: string;
    totalVendido: number;
    receita: number;
  }[]>([]);
  const [ordens, setOrdens] = useState<OrdemRow[]>([]);
  const [ordemTotal, setOrdemTotal] = useState(0);
  const [ordemPage, setOrdemPage] = useState(1);
  const [ordemLimit] = useState(10);
  const [ordemStatus, setOrdemStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOrdens, setLoadingOrdens] = useState(false);
  const [error, setError] = useState('');
  const [totalAnterior, setTotalAnterior] = useState<TotalVendas | null>(null);
  const [ultimoRefresh, setUltimoRefresh] = useState<Date | null>(null);
  const hasData = useRef(false);

  const tabs = [
    { id: 'visao', label: 'Visão Geral' },
    { id: 'vendas', label: 'Vendas' },
    { id: 'topProducts', label: 'Top Produtos' },
    { id: 'saldo', label: 'Saldo' },
    { id: 'estatisticas', label: 'Estatísticas' },
  ];

  const { from, to } = useMemo(() => periodoRange(periodo), [periodo]);
  const rangeAnterior = useMemo(() => periodoAnteriorRange(periodo), [periodo]);
  const rangeLabel = useMemo(
    () => formatRangeLabel(periodo, from, to),
    [periodo, from, to],
  );

  const loadResumo = useCallback(async () => {
    if (!event) return;
    if (!hasData.current) setLoading(true);
    setError('');
    try {
      const base = { eventId: event.id, ...(from ? { from } : {}), ...(to ? { to } : {}) };
      const baseAnterior =
        rangeAnterior.from && rangeAnterior.to
          ? { eventId: event.id, from: rangeAnterior.from, to: rangeAnterior.to }
          : null;
      const [statsData, totalData, anteriorData, seriesData, metodosData, movimentosData, productsData] =
        await Promise.all([
          getReports('estatisticas', base).catch(() => null),
          getReports('total', base).catch(() => null),
          baseAnterior ? getReports('total', baseAnterior).catch(() => null) : Promise.resolve(null),
          getReports('series', base).catch(() => []),
          getReports('metodos', base).catch(() => []),
          getReports('movimentos', base).catch(() => []),
          getReports('top-products', base).catch(() => []),
        ]);
      setStats(statsData ?? null);
      setTotalVendas(totalData ?? null);
      setTotalAnterior(anteriorData ?? null);
      setSeries(Array.isArray(seriesData) ? seriesData : []);
      setMetodos(Array.isArray(metodosData) ? metodosData : []);
      setMovimentos(Array.isArray(movimentosData) ? movimentosData : []);
      setTopProducts(
        Array.isArray(productsData)
          ? productsData
          : productsData?.items ?? [],
      );
      setUltimoRefresh(new Date());
      hasData.current = true;
    } catch {
      setError('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  }, [event, from, to, rangeAnterior.from, rangeAnterior.to]);

  const loadOrdens = useCallback(async () => {
    if (!event) return;
    setLoadingOrdens(true);
    try {
      const data = await getReports('ordens', {
        eventId: event.id,
        page: ordemPage,
        limit: ordemLimit,
        status: ordemStatus || undefined,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setOrdens(Array.isArray(data) ? data : data?.items ?? []);
      setOrdemTotal(Array.isArray(data) ? 0 : data?.total ?? 0);
    } catch {
      setOrdens([]);
    } finally {
      setLoadingOrdens(false);
    }
  }, [event, ordemPage, ordemLimit, ordemStatus, from, to]);

  useEffect(() => {
    if (activeTab === 'vendas') loadOrdens();
    else loadResumo();
  }, [activeTab, loadResumo, loadOrdens]);

  const mudarPeriodo = (p: Periodo) => {
    setPeriodo(p);
  };

  // Auto-refresh a cada 60s quando não está na tabela de vendas (evita reset da página atual).
  useEffect(() => {
    if (activeTab === 'vendas') return;
    const id = setInterval(() => loadResumo(), 60000);
    return () => clearInterval(id);
  }, [activeTab, loadResumo]);

  // Tendência % face ao período anterior (null quando não há comparação possível).
  const trendPercent = (atual: number, anterior: number | undefined | null): number | null => {
    if (anterior === undefined || anterior === null || anterior === 0) return null;
    return ((atual - anterior) / anterior) * 100;
  };

  const exportar = async () => {
    try {
      setError('');
      await exportOrdensCsv({
        eventId: event?.id,
        status: ordemStatus || undefined,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao exportar');
    }
  };

  const formatEuro = (value: number | string) =>
    `€${Number(value).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const maxSerie = Math.max(1, ...series.map((s) => Number(s.total || 0)));
  const maxMetodo = Math.max(1, ...metodos.map((m) => Number(m.total || 0)));
  const maxMovimento = Math.max(1, ...movimentos.map((m) => Number(m.total || 0)));
  const maxSold = Math.max(1, ...topProducts.map((p) => Number(p.totalVendido || 0)));
  const ordemPaginas = ordemLimit > 0 ? Math.max(1, Math.ceil(ordemTotal / ordemLimit)) : 1;
  const totalPagina = ordens.reduce((acc, o) => acc + Number(o.total || 0), 0);

  const tiposMovimento = [
    { tipo: 'load', label: 'Carregamentos', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', bar: 'from-emerald-500/40 to-emerald-400' },
    { tipo: 'consume', label: 'Consumos', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', bar: 'from-orange-500/40 to-orange-400' },
    { tipo: 'refund', label: 'Reembolsos', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', bar: 'from-blue-500/40 to-blue-400' },
    { tipo: 'cancel', label: 'Estornos', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20', bar: 'from-zinc-500/40 to-zinc-400' },
  ];

  const faturacaoAtual = Number(totalVendas?.total ?? 0);
  const faturacaoAnterior = Number(totalAnterior?.total ?? 0);
  const pedidosAtual = totalVendas?.pedidos ?? 0;
  const pedidosAnterior = totalAnterior?.pedidos ?? 0;
  const faturacaoTrend = trendPercent(faturacaoAtual, faturacaoAnterior);
  const pedidosTrend = trendPercent(pedidosAtual, pedidosAnterior);
  const trendLabel = (t: number | null) =>
    t === null ? undefined : `${t >= 0 ? '↑' : '↓'} ${Math.abs(t).toFixed(1)}%`;
  const trendDir = (t: number | null): 'up' | 'down' | undefined => (t === null ? undefined : t < 0 ? 'down' : 'up');

  return (
    <>
      <title>Relatórios - SenhasFestas</title>

      <AppShell>
        <PageHeader
          title="Relatórios"
          subtitle={
            event
              ? `${event.name} · ${rangeLabel} · ${ultimoRefresh ? `atualizado às ${ultimoRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}` : 'a carregar…'}`
              : 'Análise de vendas e desempenho'
          }
          icon={<ChartIcon className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
                {PERIODOS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => mudarPeriodo(p.id)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                      periodo === p.id
                        ? 'bg-brand text-black'
                        : 'text-zinc-400 hover:text-zinc-200',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadResumo}
                disabled={loading}
                title="Atualizar dados"
              >
                <RefreshIcon className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          }
        />

        <Tabs items={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {error && <div className="mb-4"><Alert variant="error" message={error} /></div>}

        {activeTab === 'visao' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Faturação"
                value={loading ? '…' : totalVendas ? formatEuro(totalVendas.total) : '—'}
                color="brand"
                icon={<CashIcon className="h-5 w-5" />}
                sub={totalVendas ? `${totalVendas.pedidos} pedidos` : undefined}
                trend={trendLabel(faturacaoTrend)}
                trendType={trendDir(faturacaoTrend)}
              />
              <StatCard
                label="Pedidos"
                value={loading ? '…' : totalVendas?.pedidos ?? '—'}
                color="blue"
                icon={<ClipboardIcon className="h-5 w-5" />}
                sub="No período selecionado"
                trend={trendLabel(pedidosTrend)}
                trendType={trendDir(pedidosTrend)}
              />
              <StatCard
                label="Ticket médio"
                value={
                  loading
                    ? '…'
                    : totalVendas?.pedidos
                      ? formatEuro(Number(totalVendas.total) / totalVendas.pedidos)
                      : '—'
                }
                color="green"
                icon={<WalletIcon className="h-5 w-5" />}
                sub={totalVendas?.pedidos ? `${rangeLabel}` : undefined}
              />
              <StatCard
                label="Entregues"
                value={loading ? '…' : String(stats?.entregues ?? 0)}
                color="orange"
                icon={<CashIcon className="h-5 w-5" />}
                sub={periodo === 'hoje' ? 'Hoje' : 'No período selecionado'}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-zinc-100">Vendas por dia</h3>
                  <Badge variant="neutral" size="sm">{series.length} dias</Badge>
                </div>
                {series.length === 0 ? (
                  <EmptyState title="Sem vendas no período" description="Ajusta o filtro de período para ver mais dados." />
                ) : (
                  <div className="overflow-x-auto -mx-1 px-1">
                    <div className="flex items-end gap-1.5 h-48 min-w-[320px]" style={series.length > 14 ? { minWidth: series.length * 26 } : undefined}>
                      {series.map((s, idx) => (
                        <div key={s.dia} className="flex-1 flex flex-col items-center gap-1 group" title={`${s.dia} · ${formatEuro(s.total)} · ${s.pedidos} pedidos`}>
                          <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatEuro(Number(s.total) || 0)}
                          </span>
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-brand/40 to-brand transition-all duration-500"
                            style={{ height: `${Math.max(3, (Number(s.total || 0) / maxSerie) * 100)}%` }}
                          />
                          <span
                            className={cn(
                              'text-[10px] text-zinc-500 truncate w-full text-center',
                              series.length > 14 && idx % 5 !== 0 && 'opacity-0',
                            )}
                          >
                            {s.dia.slice(5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="text-base font-semibold text-zinc-100 mb-4">Métodos de pagamento</h3>
                {metodos.length === 0 ? (
                  <EmptyState title="Sem dados" />
                ) : (
                  <div className="space-y-4">
                    {metodos.map((m) => (
                      <div key={m.metodo}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-zinc-300 font-medium">
                            {METODO_LABEL[m.metodo] ?? m.metodo}
                          </span>
                          <span className="text-zinc-400">
                            {formatEuro(m.total)} · {m.pedidos} ped.
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-surface overflow-hidden">
                          <div
                            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', METODO_COLOR[m.metodo] ?? 'from-brand to-brand-light')}
                            style={{ width: `${(Number(m.total || 0) / maxMetodo) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'vendas' && (
          <div className="space-y-4">
            <Card>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDENS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setOrdemStatus(s.id);
                        setOrdemPage(1);
                      }}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium rounded-xl border transition-colors',
                        ordemStatus === s.id
                          ? 'bg-brand text-black border-brand'
                          : 'bg-surface border-border text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={exportar}>
                  Exportar CSV
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-400 mb-3">
                <span>{ordemTotal} pedidos</span>
                {!loadingOrdens && ordens.length > 0 && (
                  <span className="text-zinc-500">
                    Soma nesta página: <span className="text-zinc-200 font-medium">{formatEuro(totalPagina)}</span>
                  </span>
                )}
              </div>

              {ordens.length === 0 && !loadingOrdens ? (
                <EmptyState title="Sem pedidos" description="Nenhum pedido corresponde aos filtros." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-zinc-500 border-b border-border">
                        <th className="pb-2 pr-3 font-medium">Data</th>
                        <th className="pb-2 pr-3 font-medium">Ref.</th>
                        <th className="pb-2 pr-3 font-medium">Origem</th>
                        <th className="pb-2 pr-3 font-medium">Itens</th>
                        <th className="pb-2 pr-3 font-medium">Método</th>
                        <th className="pb-2 pr-3 font-medium">Total</th>
                        <th className="pb-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingOrdens ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-sm text-zinc-400">
                            A carregar pedidos…
                          </td>
                        </tr>
                      ) : (
                        ordens.map((o) => (
                          <tr key={o.id} className="border-b border-border last:border-0">
                            <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">
                              {new Date(o.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}{' '}
                              <span className="text-zinc-500">
                                {new Date(o.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-xs text-zinc-400">
                              {o.id.slice(0, 8)}
                            </td>
                            <td className="py-2.5 pr-3 text-zinc-300">
                              {o.source === 'qr' ? `Mesa ${o.tableNumber ?? '—'}` : 'POS'}
                              {o.station ? ` · ${o.station}` : ''}
                            </td>
                            <td className="py-2.5 pr-3 text-zinc-400 max-w-[180px] truncate">
                              {o.items?.map((i) => `${i.quantity}x ${i.product?.name ?? ''}`).join(', ') || '—'}
                            </td>
                            <td className="py-2.5 pr-3 text-zinc-400">
                              {METODO_LABEL[o.paymentMethod] ?? o.paymentMethod}
                            </td>
                            <td className="py-2.5 pr-3 font-medium text-zinc-200">
                              {formatEuro(o.total)}
                            </td>
                            <td className="py-2.5">
                              <Badge variant={STATUS_VARIANT[o.status] ?? 'neutral'} size="sm" dot>
                                {STATUS_LABEL[o.status] ?? o.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ordemPage <= 1}
                  onClick={() => setOrdemPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-zinc-500">
                  Página {ordemPage} de {ordemPaginas} · {ordemTotal} resultados
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ordemPage >= ordemPaginas}
                  onClick={() => setOrdemPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'topProducts' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">Produtos Mais Vendidos</h2>
              <Badge variant="brand" size="sm">{topProducts.length} no topo · {rangeLabel}</Badge>
            </div>
            {topProducts.length === 0 ? (
              <EmptyState title="Sem dados disponíveis" description="Assim que houver pedidos, o ranking aparece aqui." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
                {topProducts.map((item, idx) => (
                  <Card key={item.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-zinc-100 flex items-center gap-2">
                        <span
                          className={cn(
                            'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold',
                            idx < 3 ? 'bg-brand text-black' : 'bg-surface text-zinc-400',
                          )}
                        >
                          {idx + 1}
                        </span>
                        {item.name}
                      </span>
                      <span className="text-brand-light font-medium text-sm">
                        {Number(item.totalVendido || 0)} un.
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-700"
                        style={{ width: `${(Number(item.totalVendido || 0) / maxSold) * 100}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-zinc-400">
                      <span>Preço {formatEuro(item.price)}</span>
                      <span className="text-emerald-400 font-medium">Receita {formatEuro(item.receita)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'saldo' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl">
              {['load', 'consume', 'refund', 'cancel'].map((tipo) => {
                const m = movimentos.find((x) => x.tipo === tipo);
                const cfg = tiposMovimento.find((x) => x.tipo === tipo)!;
                return (
                  <StatCard
                    key={tipo}
                    label={cfg.label}
                    value={loading ? '…' : m ? formatEuro(m.total) : '—'}
                    color={tipo === 'load' ? 'green' : tipo === 'consume' ? 'orange' : tipo === 'refund' ? 'blue' : 'brand'}
                    sub={m ? `${m.quantidade} movimentos` : undefined}
                  />
                );
              })}
            </div>

            <div className="max-w-4xl">
              <StatCard
                label="Saldo líquido no período"
                value={
                  loading
                    ? '…'
                    : formatEuro(
                        movimentos.reduce(
                          (acc, m) =>
                            acc +
                            (m.tipo === 'consume' || m.tipo === 'refund' || m.tipo === 'cancel'
                              ? -Number(m.total || 0)
                              : Number(m.total || 0)),
                          0,
                        ),
                      )
                }
                color="brand"
                icon={<WalletIcon className="h-5 w-5" />}
                sub="Carregamentos − consumos − reembolsos − estornos"
              />
            </div>

            <Card className="max-w-2xl">
              <h3 className="text-base font-semibold text-zinc-100 mb-4">Movimentos por tipo</h3>
              {movimentos.length === 0 ? (
                <EmptyState title="Sem movimentos no período" />
              ) : (
                <div className="space-y-5">
                  {tiposMovimento.map((cfg) => {
                    const m = movimentos.find((x) => x.tipo === cfg.tipo);
                    return (
                      <div key={cfg.tipo}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-zinc-300 font-medium">{cfg.label}</span>
                          <span className={cfg.color}>
                            {m ? formatEuro(m.total) : '—'}
                            {m ? ` · ${m.quantidade} mov.` : ''}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-surface overflow-hidden">
                          <div
                            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', cfg.bar)}
                            style={{ width: `${m ? (Number(m.total || 0) / maxMovimento) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'estatisticas' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Recebidos" value={String(stats?.recebidos ?? 0)} color="blue" icon={<ClipboardIcon className="h-5 w-5" />} sub="No período" />
              <StatCard label="Em Preparação" value={String(stats?.emPreparacao ?? 0)} color="brand" sub="No período" />
              <StatCard label="Prontos" value={String(stats?.prontos ?? 0)} color="orange" sub="No período" />
              <StatCard label="Entregues" value={String(stats?.entregues ?? 0)} color="green" sub={periodo === 'hoje' ? 'Hoje' : 'No período'} />
            </div>

            <Card className="max-w-2xl">
              <h3 className="text-base font-semibold text-zinc-100 mb-4">
                Fluxo de pedidos {periodo === 'hoje' ? '(hoje)' : '(período)'}
              </h3>
              {(() => {
                const valores = [stats?.recebidos ?? 0, stats?.emPreparacao ?? 0, stats?.prontos ?? 0, stats?.entregues ?? 0];
                const maxValor = Math.max(1, ...valores);
                return (
                  <div className="flex items-end gap-2 h-40">
                    {[
                      { label: 'Recebidos', value: stats?.recebidos ?? 0, color: 'from-blue-500/40 to-blue-400' },
                      { label: 'Preparação', value: stats?.emPreparacao ?? 0, color: 'from-amber-500/40 to-amber-300' },
                      { label: 'Prontos', value: stats?.prontos ?? 0, color: 'from-orange-500/40 to-orange-400' },
                      { label: 'Entregues', value: stats?.entregues ?? 0, color: 'from-emerald-500/40 to-emerald-400' },
                    ].map((b) => (
                      <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold text-zinc-200">{b.value}</span>
                        <div
                          className={cn('w-full rounded-t-md bg-gradient-to-t transition-all duration-500', b.color)}
                          style={{ height: `${Math.max(4, (b.value / maxValor) * 100)}%` }}
                        />
                        <span className="text-[10px] text-zinc-500 text-center">{b.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <p className="mt-3 text-xs text-zinc-500">
                Distribuição dos pedidos por estado no {periodo === 'hoje' ? 'dia de hoje' : 'período selecionado'}.
              </p>
            </Card>
          </div>
        )}
      </AppShell>
    </>
  );
}