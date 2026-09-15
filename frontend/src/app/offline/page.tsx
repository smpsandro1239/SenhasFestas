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
      <p className="max-w-md text-zinc-400">
        Não há ligação à internet neste momento. Os pedidos já registados
        continuam seguros no servidor — assim que a rede voltar, tudo é
        sincronizado automaticamente.
      </p>
      <a
        href="/"
        className="mt-2 rounded-full bg-zinc-100 px-6 py-3 font-medium text-zinc-900 transition hover:bg-zinc-200"
      >
        Tentar novamente
      </a>
    </main>
  );
}
