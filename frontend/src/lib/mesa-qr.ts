export interface QrMesaParsed {
  shortCode: string;
  numero: string | null;
}

export function parseQrMesa(texto: string): QrMesaParsed | null {
  const path = extraiCaminho(texto);
  if (!path) return null;
  const mesa = path.match(/^\/mesa\/([^/?#]+)\/([^/?#]+)/);
  if (mesa) return { shortCode: mesa[1], numero: mesa[2] };
  const entrar = path.match(/^\/entrar\/([^/?#]+)/);
  if (entrar) return { shortCode: entrar[1], numero: null };
  return null;
}

export function montarUrlMesa(origin: string, shortCode: string, numero: string): string {
  return `${origin.replace(/\/+$/, '')}/mesa/${shortCode}/${numero}`;
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