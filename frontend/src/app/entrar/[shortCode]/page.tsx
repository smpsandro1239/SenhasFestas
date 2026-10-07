'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { UserIcon, LockIcon, BellIcon, QrIcon } from '@/components/ui/icons';
import { useAuth } from '@/lib/auth-context';
import { getEventByCode, getEvents, getBalance, enterEvent } from '@/lib/api';
import { normalizarShortCode, podeTrocarEvento } from '@/lib/entrar';

type Evento = { id: string; name: string; shortCode: string };
type Estado = 'carregando' | 'ok' | 'nao-encontrado';

export default function EntrarPageWrapper() {
  return (
    <Suspense fallback={null}>
      <EntrarPage />
    </Suspense>
  );
}

function EntrarPage() {
  const params = useParams<{ shortCode: string }>();
  const codigoParam = typeof params?.shortCode === 'string' ? params.shortCode : '';
  const codigo = normalizarShortCode(codigoParam);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, register } = useAuth();

  const mesaParam = searchParams.get('table') ?? '';
  const destinoQr = useCallback(
    (eventoId: string) => {
      const mesa = mesaParam ? `&table=${encodeURIComponent(mesaParam)}` : '';
      return `/qr-order?event=${eventoId}${mesa}`;
    },
    [mesaParam],
  );

  const [estado, setEstado] = useState<Estado>('carregando');
  const [evento, setEvento] = useState<Evento | null>(null);
  const [membro, setMembro] = useState<boolean | null>(null);
  const [podeTrocar, setPodeTrocar] = useState(false);
  const [erro, setErro] = useState('');
  const [acao, setAcao] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erroRegisto, setErroRegisto] = useState('');
  const [registando, setRegistando] = useState(false);

  useEffect(() => {
    if (!codigo) {
      setEstado('nao-encontrado');
      return;
    }
    let ativo = true;
    getEventByCode(codigo)
      .then((ev) => {
        if (ativo) {
          setEvento(ev);
          setEstado('ok');
        }
      })
      .catch(() => {
        if (ativo) setEstado('nao-encontrado');
      });
    return () => {
      ativo = false;
    };
  }, [codigo]);

  useEffect(() => {
    if (authLoading || !user || estado !== 'ok' || !evento) return;
    let ativo = true;
    (async () => {
      try {
        const eventos = await getEvents();
        const lista: any[] = Array.isArray(eventos) ? eventos : [];
        if (!ativo) return;
        if (lista.some((e) => e.id === evento.id)) {
          router.replace(destinoQr(evento.id));
          return;
        }
        setMembro(false);
        const outros = lista.filter((e) => e.id !== evento.id);
        if (outros.length === 0) {
          setPodeTrocar(true);
          return;
        }
        const saldos = await Promise.all(
          outros.map((e) => getBalance(user.id, e.id).catch(() => ({ balance: 0 }))),
        );
        if (ativo) setPodeTrocar(podeTrocarEvento(saldos));
      } catch {
        if (ativo) {
          setMembro(false);
          setPodeTrocar(true);
        }
      }
    })();
    return () => {
      ativo = false;
    };
  }, [authLoading, user, estado, evento, router, destinoQr]);

  const entrarNoEvento = async (replace: boolean) => {
    if (!evento) return;
    setAcao(true);
    setErro('');
    try {
      await enterEvent(codigo, replace);
      router.push(destinoQr(evento.id));
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao entrar no evento');
      setAcao(false);
    }
  };

  const submeterRegisto = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroRegisto('');
    if (password !== confirmar) {
      setErroRegisto('As palavras-passe não coincidem');
      return;
    }
    setRegistando(true);
    try {
      await register({ name, email, phone: phone || undefined, password, eventCode: codigo });
      if (evento) router.push(destinoQr(evento.id));
    } catch (err: any) {
      setErroRegisto(err?.message ?? 'Erro no registo');
      setRegistando(false);
    }
  };

  if (estado === 'nao-encontrado') {
    return (
      <AuthLayout subtitle="Entrar no evento">
        <div className="space-y-6 text-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
              Evento não encontrado
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Este código não corresponde a nenhum evento. Pede um novo QR ao organizador.
            </p>
          </div>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => router.push('/')}
          >
            Início
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const subtitle =
    estado === 'ok' && evento ? `Entrar em ${evento.name}` : 'A verificar o código do QR...';
  const aEspera = estado === 'carregando' || authLoading || (!!user && membro === null);

  return (
    <AuthLayout subtitle={subtitle}>
      {aEspera ? (
        <div className="space-y-3" aria-busy="true" aria-label="A verificar">
          <div className="shimmer h-16 rounded-2xl" />
          <div className="shimmer h-16 rounded-2xl" />
          <div className="shimmer h-16 rounded-2xl" />
        </div>
      ) : !user ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-50">Criar conta</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Preenche os teus dados para entrares no evento.
            </p>
          </div>

          {erroRegisto && <Alert variant="error" message={erroRegisto} />}

          <form onSubmit={submeterRegisto} className="space-y-4">
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
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
                icon={<LockIcon className="h-4 w-4" />}
              />
            </div>

            <Button type="submit" loading={registando} size="lg" className="w-full mt-2">
              {registando ? 'A registar...' : 'Criar conta e entrar'}
            </Button>
          </form>

          <div className="pt-2 text-center">
            <p className="text-zinc-400">
              Já tem conta?{' '}
              <Link
                href={`/auth/login?from=${encodeURIComponent(
                  `/entrar/${codigoParam}${mesaParam ? `?table=${encodeURIComponent(mesaParam)}` : ''}`,
                )}`}
                className="text-brand-light hover:text-zinc-200 font-medium transition-colors"
              >
                Iniciar sessão
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-brand/10 text-brand mb-4">
              <QrIcon className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-50">{evento?.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Ainda não és membro deste evento. Entra para ficares com a tua ficha de saldo aqui.
            </p>
          </div>

          {erro && <Alert variant="error" message={erro} />}

          {!podeTrocar && (
            <Alert
              variant="info"
              message="Tens saldo noutro evento. Usa o QR desse evento ou esgota o saldo antes de trocar."
            />
          )}

          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              loading={acao}
              onClick={() => entrarNoEvento(false)}
            >
              Entrar também neste evento
            </Button>
            {podeTrocar && (
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                loading={acao}
                onClick={() => entrarNoEvento(true)}
              >
                Mudar para este evento
              </Button>
            )}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
