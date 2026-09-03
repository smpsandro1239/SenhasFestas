import { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function CaixaPage() {
  const [activeTab, setActiveTab] = useState('fecho');
  const [caixaAberta, setCaixaAberta] = useState(null);
  const [formData, setFormData] = useState({
    valorInicial: '',
    observacoes: '',
  });
  const [fechoData, setFechoData] = useState({
    totalReal: '',
    observacoes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  // Funções para buscar dados (simulando chamadas à API)
  const carregarCaixaAberta = async () => {
    setLoading(true);
    try {
      // Simular chamada à API
      await new Promise(resolve => setTimeout(resolve, 500));
      setCaixaAberta({
        id: 'cx-001',
        operador: 'João Silva',
        evento: 'Festa de Aldeia',
        abertoEm: '15/08/2026 20:00',
        valorInicial: 50.00,
      });
    } catch (err) {
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
      // Simular chamada à API para fechar caixa
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess('Caixa fechado com sucesso!');
      setFechoData({ totalReal: '', observacoes: '' });
      setCaixaAberta(null);
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
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
      // Simular chamada à API para abrir caixa
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess('Caixa aberto com sucesso!');
      setFormData({ valorInicial: '', observacoes: '' });
      await carregarCaixaAberta();
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError('Erro ao abrir o caixa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCaixaAberta();
  }, []);

  return (
    <>
      <Head>
        <title>Fecho de Caixa - SenhasFestas</title>
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-amber-500">
            💰 Fecho de Caixa
          </h1>

          <nav className="flex space-x-4 mb-8">
            <button
              onClick={() => setActiveTab('fecho')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'fecho' ? 'bg-amber-600' : 'bg-slate-700'
              }`}
            >
              📋 Fecho de Caixa
            </button>
            <button
              onClick={() => setActiveTab('movimentacoes')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'movimentacoes' ? 'bg-amber-600' : 'bg-slate-700'
              }`}
            >
              💸 Movimentações
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'historico' ? 'bg-amber-600' : 'bg-slate-700'
              }`}
            >
              📜 Histórico
            </button>
          </nav>

          <div className="bg-slate-800 rounded-xl p-6">
            {activeTab === 'fecho' && (
              <div>
                {!caixaAberta && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Abrir Caixa</h2>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      abrirCaixa();
                    }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                          Valor Inicial (€)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.valorInicial}
                          onChange={(e) => setFormData({...formData, valorInicial: e.target.value})}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="Ex: 50.00"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                          Observações (opcional)
                        </label>
                        <textarea
                          value={formData.observacoes}
                          onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          rows="3"
                          placeholder="Observações sobre o fundo de troco..."
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {loading ? 'Abrindo...' : 'Abrir Caixa'}
                      </button>
                    </form>
                  </div>
                )}

                {caixaAberta && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Caixa Aberto</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="bg-slate-700 rounded-lg p-4">
                          <div className="text-slate-400">Operador:</div>
                          <div className="text-lg font-bold">{caixaAberta.operador}</div>
                        </div>
                        <div className="bg-slate-700 rounded-lg p-4">
                          <div className="text-slate-400">Evento:</div>
                          <div className="text-lg font-bold">{caixaAberta.evento}</div>
                        </div>
                        <div className="bg-slate-700 rounded-lg p-4">
                          <div className="text-slate-400">Aberto em:</div>
                          <div className="text-lg font-bold">{caixaAberta.abertoEm}</div>
                        </div>
                        <div className="bg-slate-700 rounded-lg p-4">
                          <div className="text-slate-400">Valor Inicial:</div>
                          <div className="text-lg font-bold text-green-400">€{caixaAberta.valorInicial.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-xl font-bold mb-3">Fechar Caixa</h3>
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          fecharCaixa();
                        }} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                              Total em Caixa (€)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={fechoData.totalReal}
                              onChange={(e) => setFechoData({...fechoData, totalReal: e.target.value})}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                              placeholder="Ex: 425.50"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                              Observações (opcional)
                            </label>
                            <textarea
                              value={fechoData.observacoes}
                              onChange={(e) => setFechoData({...fechoData, observacoes: e.target.value})}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                              rows="3"
                              placeholder="Observações sobre o fechamento..."
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {loading ? 'Fechando...' : 'Fechar Caixa'}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}
                
                {success && (
                  <div className="mt-4 p-4 bg-green-900/20 border border-green-500 rounded-lg text-green-400">
                    {success}
                  </div>
                )}
                
                {error && (
                  <div className="mt-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
                    {error}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'movimentacoes' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Movimentações de Caixa</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-slate-900">
                    <thead>
                      <tr className="bg-slate-800">
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                          Hora
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                          Tipo
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                          Valor
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                          Operador
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                          Observação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-slate-700">
                        <td className="px-4 py-3 text-slate-300">20:15</td>
                        <td className="px-4 py-3 text-green-400">Entrada</td>
                        <td className="px-4 py-3 text-green-400">+€150</td>
                        <td className="px-4 py-3 text-slate-300">João Silva</td>
                        <td className="px-4 py-3 text-slate-400">Venda de senhas</td>
                      </tr>
                      <tr className="hover:bg-slate-700">
                        <td className="px-4 py-3 text-slate-300">21:30</td>
                        <td className="px-4 py-3 text-red-400">Saída</td>
                        <td className="px-4 py-3 text-red-400">-€45</td>
                        <td className="px-4 py-3 text-slate-300">Maria Costa</td>
                        <td className="px-4 py-3 text-slate-400">Compra de gelo</td>
                      </tr>
                      <tr className="hover:bg-slate-700">
                        <td className="px-4 py-3 text-slate-300">22:45</td>
                        <td className="px-4 py-3 text-green-400">Entrada</td>
                        <td className="px-4 py-3 text-green-400">+€89</td>
                        <td className="px-4 py-3 text-slate-300">João Silva</td>
                        <td className="px-4 py-3 text-slate-400">Venda de bebidas</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeTab === 'historico' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Histórico de Fechamentos</h2>
                <div className="space-y-4">
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between">
                      <span className="font-bold">Fechamento #001</span>
                      <span className="text-green-400">Fechado</span>
                    </div>
                    <div className="text-slate-400 text-sm">
                      15/08/2026 • 02:30 • Diferença: +€5.20
                    </div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between">
                      <span className="font-bold">Fechamento #000</span>
                      <span className="text-red-400">Fechado</span>
                    </div>
                    <div className="text-slate-400 text-sm">
                      14/08/2026 • 02:15 • Diferença: -€3.80
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}