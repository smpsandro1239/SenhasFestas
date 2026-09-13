'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { WalletIcon, ArrowLeftIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth-context';
import { useCurrentEvent } from '@/lib/use-current-event';
import { getBalance, loadBalance, getMe } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

const QUICK_AMOUNTS = [5, 10, 20, 50];
const STAFF_ROLES = ['superadmin', 'organizer', 'cashier', 'treasurer'];

export default function BalancePageWrapper() {
  return (
    <Suspense fallback={null}>
      <BalancePage />
    </Suspense>
  );
}

function BalancePage() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const { event } = useCurrentEvent();
  const eventId = event?.id;
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [me, setMe] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const accessCode = (me?.accessCode as string | undefined) || (user?.accessCode as string | undefined);

  useEffect(() => {
    if (!user) return;
    getMe()
      .then((meResult) => setMe(meResult))
      .catch(() => setMe(null));
    getBalance(user.id, eventId)
      .then((b) => setCurrentBalance(Number(b?.balance ?? 0)))
      .catch((err: any) => setError(err?.message ?? 'Não foi possível carregar o saldo'));
  }, [user, eventId]);

  const copiarCodigo = async () => {
    if (!accessCode) return;
    try {
      await navigator.clipboard.writeText(accessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Não foi possível copiar o código');
    }
  };

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
      await loadBalance(user.id, numericAmount, eventId);
      const updated = await getBalance(user.id, eventId);
      setCurrentBalance(Number(updated?.balance ?? 0));
      setAmount('');
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível carregar o saldo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout subtitle="Carregue saldo na sua conta para consumir">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl brand-chip">
          <WalletIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-50">O Meu Saldo</h2>
          <p className="text-sm text-zinc-400">Consulta do saldo da conta</p>
        </div>
      </div>

      {currentBalance !== null && (
        <div className="mt-6 flex items-center justify-between px-4 py-3 rounded-xl bg-surface border border-border">
          <span className="text-sm text-zinc-400">Saldo atual</span>
          <span className="text-lg font-bold text-emerald-400">€{currentBalance.toFixed(2)}</span>
        </div>
      )}

      {error && <div className="mt-4"><Alert variant="error" message={error} /></div>}

      {!isStaff && user && (
        <div className="mt-6 rounded-xl border border-amber-300/25 gradient-brand-soft p-4 text-center">
          <p className="text-sm font-semibold text-amber-200">QR para recarga na caixa</p>
          <div className="mt-3 mx-auto bg-white p-3 rounded-xl w-fit">
            <QRCodeSVG value={user.id} size={128} />
          </div>
          {accessCode && (
            <div className="mt-3">
              <p className="text-xs text-zinc-400">ou digite o código na caixa</p>
              <button
                type="button"
                onClick={copiarCodigo}
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border hover:border-amber-300/40 transition-colors"
                title="Copiar código"
              >
                <span className="text-2xl font-bold tracking-[0.35em] text-amber-200 font-mono">
                  {accessCode}
                </span>
                <span className="text-xs text-zinc-400">{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            Mostra este código na caixa para carregar saldo.
          </p>
        </div>
      )}

      {!isStaff ? (
        <div className="mt-6">
          <Alert
            variant="info"
            message="Para carregar saldo, dirija-se ao bar ou ao caixa do evento. O carregamento é feito presencialmente pela equipa."
          />
          <div className="text-center mt-6">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
              <ArrowLeftIcon className="h-4 w-4" />
              Voltar ao menu
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
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
              icon={<span className="text-zinc-400 font-semibold">€</span>}
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
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
              <ArrowLeftIcon className="h-4 w-4" />
              Voltar ao menu
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}