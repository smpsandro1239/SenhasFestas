'use client';

import { useState } from 'react';

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState('vendas');

  return (
    <>
      <title>Relatórios - SenhasFestas</title>

      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-cyan-400">
            📊 Relatórios Operacionais
          </h1>

          <nav className="flex space-x-4 mb-8">
            <button
              onClick={() => setActiveTab('vendas')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'vendas' ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              💰 Vendas
            </button>
            <button
              onClick={() => setActiveTab('topProducts')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'topProducts' ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              🏆 Top Products
            </button>
            <button
              onClick={() => setActiveTab('saldo')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'saldo' ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              💳 Saldo
            </button>
            <button
              onClick={() => setActiveTab('estatisticas')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'estatisticas' ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              📈 Estatísticas
            </button>
          </nav>

          <div className="bg-slate-800 rounded-xl p-6">
            {activeTab === 'vendas' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Vendas por Período</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-cyan-400">€1.250</div>
                    <div className="text-slate-400">Hoje</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-cyan-400">€8.420</div>
                    <div className="text-slate-400">Esta Semana</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-cyan-400">€32.180</div>
                    <div className="text-slate-400">Este Mês</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'topProducts' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Top Produtos</h2>
                <div className="space-y-3">
                  <div className="bg-slate-700 rounded-lg p-4 flex justify-between">
                    <span>1. Cerveja Artesanal</span>
                    <span className="text-cyan-400">245 unidades</span>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 flex justify-between">
                    <span>2. Bifana</span>
                    <span className="text-cyan-400">189 unidades</span>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 flex justify-between">
                    <span>3. Caldo Verde</span>
                    <span className="text-cyan-400">156 unidades</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'saldo' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Saldo Carregado vs Consumido</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-400">€5.420</div>
                    <div className="text-slate-400">Carregado</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-orange-400">€4.180</div>
                    <div className="text-slate-400">Consumido</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-cyan-400">€1.240</div>
                    <div className="text-slate-400">Saldo Atual</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'estatisticas' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Estatísticas Operacionais</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="text-slate-400">Tempo Médio Preparação</div>
                    <div className="text-2xl font-bold text-cyan-400">3:45 min</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="text-slate-400">Pedidos/Hora</div>
                    <div className="text-2xl font-bold text-cyan-400">42</div>
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
