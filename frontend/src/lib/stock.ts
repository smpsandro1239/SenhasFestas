export interface StockProduto {
  stock?: number | null;
}

// stock null/undefined = sem controlo (menu aberto, o bar decide). Um número
// (mesmo 0) = controlo: o stock é abatido a cada pedido e reposto no
// cancelamento, e esgotado quando chega a 0.
export function temControloStock<T extends StockProduto>(produto: T): boolean {
  return produto.stock != null;
}

// Unidades que ainda se podem pedir com o que já está no carrinho. Sem
// controlo => ilimitado (null). Com controlo => stock - noCarrinho, nunca
// negativo.
export function stockRestante<T extends StockProduto>(
  produto: T,
  noCarrinho: number,
): number | null {
  if (produto.stock == null) return null;
  return Math.max(0, Number(produto.stock) - Math.max(0, noCarrinho));
}

export function esgotado<T extends StockProduto>(produto: T): boolean {
  return produto.stock != null && Number(produto.stock) <= 0;
}

// Pode-se adicionar mais uma unidade? Sem controlo => sim, sempre. Com
// controlo => precisa de ficar pelo menos uma disponível.
export function podeAdicionar<T extends StockProduto>(
  produto: T,
  noCarrinho: number,
): boolean {
  const restante = stockRestante(produto, noCarrinho);
  return restante === null || restante > 0;
}