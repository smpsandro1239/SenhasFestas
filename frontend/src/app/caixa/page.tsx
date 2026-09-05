'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { CashIcon, CheckIcon } from '@/components/ui/icons';

export default function CaixaPage() {
  const [activeTab, setActiveTab] = useState('fecho');
  const [caixaAberta, setCaixaAberta] = useState<any>(null);
  const [formData, setFormData] = useState({ valorInicial: '', observacoes: '' });
  const [fechoData, setFechoData] = useState({ totalReal: '', observacoes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const carregarCaixaAberta = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCaixaAberta({
        id: 'cx-001',
        operador: 'João Silva',
        evento: 'Festa de Aldeia',
        abertoEm: '15/08/2026 20:00',
        valorInicial: 50.0,
      });
    } catch {
      setError('Erro ao carregar estado do caixa');
    } finally {
      setLoading(false);
    }
  };

  const fecharCaixa = async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess('Caixa fechado com sucesso!');
      setFechoData({ totalReal: '', observacoes: '' });
      setCaixaAberta(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Erro ao fechar o caixa');
    } finally {
      setLoading(false);
    }
  };

  const abrirCaixa = async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess('Caixa aberto com sucesso!');
      setFormData({ valorInicial: '', observacoes: '' });
      await carregarCaixaAberta();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Erro ao abrir o caixa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCaixaAberta();
  }, []);

  const tabs = [
    { id: 'fecho', label: 'Fecho de Caixa' },
    { id: 'movimentacoes', label: 'Movimentações' },
    { id: 'historico', label: 'Histórico' },
  ];

  const movements = [
    { hora: '20:15', tipo: 'Entrada', valor: '+€150', operador: 'João Silva', obs: 'Venda de senhas' },
    { hora: '21:30', tipo: 'Saída', valor: '-€45', operador: 'Maria Costa', obs: 'Compra de gelo' },
    { hora: '22:45', tipo: 'Entrada', valor: '+€89', operador: 'João Silva', obs: 'Venda de bebidas' },
  ];

  const history = [
    { numero: '#001', status: 'Fechado' as const, desc: '15/08/2026 • 02:30 • Diferença: +€5.20', variant: 'success' as const },
    { numero: '#000', status: 'Fechado' as const, desc: '14/08/2026 • 02:15 • Diferença: -€3.80', variant: 'danger' as const },
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