'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { UserIcon, LockIcon } from '@/components/ui/icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Erro no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout subtitle="Sistema de gestão de pedidos para festas de aldeia">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
            Bem-vindo de volta
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Faça login para continuar</p>
        </div>

        {error && <Alert variant="error" message={error} />}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@senhasfestas.com"
            required
            icon={<UserIcon className="h-4 w-4" />}
          />

          <Input
            label="Palavra-passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            icon={<LockIcon className="h-4 w-4" />}
          />

          <Button type="submit" loading={loading} size="lg" className="w-full">
            {loading ? 'A entrar...' : 'Entrar'}
          </Button>
        </form>

        <div className="pt-2 text-center">
          <p className="text-zinc-500">
            Ainda não tem conta?{' '}
            <Link href="/auth/register" className="text-brand hover:text-brand-light font-medium transition-colors">
              Registe-se
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}