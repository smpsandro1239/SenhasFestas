'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { UserIcon, LockIcon, BellIcon } from '@/components/ui/icons';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem');
      setLoading(false);
      return;
    }

    try {
      await register({ name, email, phone, password });
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Erro no registo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout subtitle="Crie a sua conta para começar a usar o sistema">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
            Criar conta
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Preencha os seus dados</p>
        </div>

        {error && <Alert variant="error" message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome Completo"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="O seu nome"
            required
            icon={<UserIcon className="h-4 w-4" />}
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemplo@email.com"
            required
            icon={<BellIcon className="h-4 w-4" />}
          />

          <Input
            label="Telefone (opcional)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="912345678"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Palavra-passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              icon={<LockIcon className="h-4 w-4" />}
            />

            <Input
              label="Confirmar"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              icon={<LockIcon className="h-4 w-4" />}
            />
          </div>

          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            {loading ? 'A registar...' : 'Criar Conta'}
          </Button>
        </form>

        <div className="pt-2 text-center">
          <p className="text-zinc-500">
            Já tem conta?{' '}
            <Link href="/auth/login" className="text-brand hover:text-brand-light font-medium transition-colors">
              Iniciar sessão
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}