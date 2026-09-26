import type { Product, ProductGroup } from './types';

export function groupProducts(products: Product[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const product of products) {
    const key = product.category?.id ?? '__none__';
    if (!groups.has(key)) {
      groups.set(key, { category: product.category ?? null, items: [] });
    }
    groups.get(key)!.items.push(product);
  }
  return [...groups.values()].sort((a, b) => {
    const orderA = a.category?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.category?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}