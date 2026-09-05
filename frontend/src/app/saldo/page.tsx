'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { WalletIcon, ArrowLeftIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth-context';
import { getBalance, loadBalance } from '@/lib/api';

const QUICK_AMOUNTS = [5, 10, 20, 50];

export default function BalancePage() {
  const { user } = useAuth();
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    getBalance(user.id)
      .then((b) => setCurrentBalance(Number(b?.currentBalance ?? 0)))
      .catch(() => {});
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Insira um valor válido');
      setLoading(false);
      return;
    }

    try {
      await loadBalance(user.id, numericAmount);
      const updated = await getBalance(user.id);
      setCurrentBalance(Number(updated?.currentBalance ?? 0));
      setAmount('');
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível carregar o saldo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout subtitle="Carregue saldo na sua conta para consumir">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand">
            <WalletIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-50">
              Carregar Saldo
            </h2>
            <p className="text-sm text-zinc-500">Escolha um valor</p>
          </div>
        </div>

        {currentBalance !== null && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface border border-border">
            <span className="text-sm text-zinc-500">Saldo atual</span>
            <span className="text-lg font-bold text-emerald-400">€{currentBalance.toFixed(2)}</span>
          </div>
        )}

        {error && <Alert variant="error" message={error} />}

        <div className="space-y-4">
          <Input
            label="Valor a carregar (€)"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10.00"
            required
            inputSize="lg"
            icon={<span className="text-zinc-500 font-semibold">€</span>}
          />

          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((value) => {
              const active = parseFloat(amount) === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(value.toString())}
                  className={cn(
                    'py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border',
                    active
                      ? 'bg-brand text-black border-brand glow-amber'
                      : 'bg-surface border-border text-zinc-300 hover:bg-surface-hover hover:border-border-hover',
                  )}
                >
                  €{value}
                </button>
              );
            })}
          </div>
        </div>

        <Button type="submit" loading={loading} size="lg" className="w-full" variant="success">
          {loading ? 'A carregar...' : 'Confirmar Carregamento'}
        </Button>

        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
            Voltar ao menu
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}