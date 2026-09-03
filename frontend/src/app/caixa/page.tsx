import { NextPage } from 'next';
import Head from 'next/head';
import { useState } from 'react';

export default function CaixaPage() {
  const [activeTab, setActiveTab] = useState('fecho');

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
                <h2 className="text-2xl font-bold mb-4">Fecho de Caixa Atual</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="text-slate-400">Data:</div>
                      <div className="text-lg font-bold">15/08/2026</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="text-slate-400">Turno:</div>
                      <div className="text-lg font-bold">Noite (20:00-02:00)</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="text-slate-400">Operador:</div>
                      <div className="text-lg font-bold">João Silva</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="text-slate-400">Evento:</div>
                      <div className="text-lg font-bold">Festa de Aldeia</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-xl font-bold mb-3">Resumo Financeiro</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-slate-700 rounded-lg p-4 text-center">
                      <div className="text-slate-400">Numerário</div>
                      <div className="text-2xl font-bold text-green-400">€1.240</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4 text-center">
                      <div className="text-slate-400">MB Way</div>
                      <div className="text-2xl font-bold text-blue-400">€890</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4 text-center">
                      <div className="text-slate-400">Saldo Pré-carregado</div>
                      <div className="text-2xl font-bold text-purple-400">€2.050</div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-slate-700 rounded-lg">
                    <div className="text-slate-400 font-bold">
                      Total Caixa Teórico: €4.180
                    </div>
                    <div className="text-slate-400 font-bold mt-2">
                      Total Caixa Real: €4.150
                    </div>
                    <div className="text-orange-400 font-bold mt-2">
                      Diferença: -€30 (Falta)
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg">
                    ✅ Fechar Caixa
                  </button>
                </div>
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
          </div>
        </div>
      </main>
    </>
  );
}