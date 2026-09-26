export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number | string;
  availability?: string;
  stock?: number;
  imageUrl?: string;
  isActive?: boolean;
  category?: ProductCategory | null;
  createdAt?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface ProductGroup {
  category: ProductCategory | null;
  items: Product[];
}