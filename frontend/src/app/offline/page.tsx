import Link from 'next/link';

export const metadata = {
  title: 'Estás offline — SenhasFestas',
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <span className="text-6xl" role="img" aria-label="sem ligação">
        📡
      </span>
      <h1 className="text-2xl font-bold text-zinc-100">Estás offline</h1>
      <p className="max-w-md text-zinc-300">
        Não há ligação à Internet neste momento. Esta página não consegue confirmar
        se uma operação recente foi guardada. Quando a ligação regressar, volta à
        aplicação e confirma o estado dos pedidos antes de repetir uma operação.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-zinc-100 px-6 py-3 font-semibold text-zinc-900 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        Voltar a tentar
      </Link>
    </main>
  );
}
