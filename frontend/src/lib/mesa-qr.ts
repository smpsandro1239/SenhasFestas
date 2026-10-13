export interface QrMesaParsed {
  shortCode: string;
  numero: string | null;
}

export function parseQrMesa(texto: string): QrMesaParsed | null {
  const path = extraiCaminho(texto);
  if (!path) return null;
  const mesa = path.match(/^\/mesa\/([^/?#]+)\/([^/?#]+)/);
  if (mesa) return { shortCode: descodificar(mesa[1]), numero: descodificar(mesa[2]) };
  const entrar = path.match(/^\/entrar\/([^/?#]+)/);
  if (entrar) return { shortCode: descodificar(entrar[1]), numero: null };
  return null;
}

export function montarUrlMesa(origin: string, shortCode: string, numero: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/mesa/${encodeURIComponent(shortCode)}/${encodeURIComponent(numero)}`;
}

function descodificar(valor: string): string {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

function extraiCaminho(texto: string): string | null {
  const t = texto.trim();
  if (t.startsWith('http://') || t.startsWith('https://')) {
    try {
      return new URL(t).pathname;
    } catch {
      return null;
    }
  }
  return t.startsWith('/') ? t : null;
}