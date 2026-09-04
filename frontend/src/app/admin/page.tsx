'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('eventos');

  return (
    <>
      <title>Admin - SenhasFestas</title>
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-purple-400">
            ⚙️ Painel de Administração
          </h1>

          <nav className="flex space-x-4 mb-8">
            <button
              onClick={() => setActiveTab('eventos')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'eventos' ? 'bg-purple-600' : 'bg-slate-700'
              }`}
            >
              📅 Eventos
            </button>
            <button
              onClick={() => setActiveTab('utilizadores')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'utilizadores' ? 'bg-purple-600' : 'bg-slate-700'
              }`}
            >
              👥 Utilizadores
            </button>
            <button
              onClick={() => setActiveTab('configuracao')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'configuracao' ? 'bg-purple-600' : 'bg-slate-700'
              }`}
            >
              🔧 Configuração
            </button>
          </nav>

          <div className="bg-slate-800 rounded-xl p-6">
            {activeTab === 'eventos' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Eventos</h2>
                <p className="text-slate-400">
                  Gerir eventos, criar novos, editar datas e fechar eventos.
                </p>
                <div className="mt-4 bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-300">
                    🎉 Festa de Aldeia - Agosto 2026 (Ativo)
                  </p>
                  <p className="text-slate-400 text-sm">
                    Local: Praça Central • Organizador: Junta de Freguesia
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'utilizadores' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Utilizadores</h2>
                <p className="text-slate-400">
                  Gerir perfis e permissões dos utilizadores do evento.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="bg-slate-700 rounded-lg p-4 flex justify-between">
                    <span>admin@senhasfestas.com</span>
                    <span className="text-purple-400">Superadmin</span>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 flex justify-between">
                    <span>operador@senhasfestas.com</span>
                    <span className="text-yellow-400">Operador</span>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4 flex justify-between">
                    <span>cozinha@senhasfestas.com</span>
                    <span className="text-green-400">Cozinha</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'configuracao' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Configuração</h2>
                <p className="text-slate-400">
                  Configurar moeda, impostos e regras do evento.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="bg-slate-700 rounded-lg p-4">
                    <span className="text-slate-400">Moeda:</span>
                    <span className="ml-2">€ EUR</span>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4">
                    <span className="text-slate-400">IVA:</span>
                    <span className="ml-2">6%</span>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-4">
                    <span className="text-slate-400">Pagamento:</span>
                    <span className="ml-2">Numerário • MB Way • Saldo</span>
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
