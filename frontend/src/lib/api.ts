const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '';
const API_URL = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '');
const API_BASE = API_URL ? `${API_URL}/api` : '/api';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  const config: RequestInit = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro na requisição');
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<any> {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(data: any): Promise<any> {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getOrders(): Promise<any[]> {
  return apiRequest('/orders');
}

export async function getOrdersByEvent(eventId: string): Promise<any[]> {
  return apiRequest(`/orders/event/${eventId}`);
}

export async function createOrder(data: any): Promise<any> {
  return apiRequest('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOrderStatus(orderId: string, status: string): Promise<any> {
  return apiRequest(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getBalance(userId: string): Promise<any> {
  return apiRequest(`/balances/${userId}`);
}

export async function loadBalance(userId: string, amount: number): Promise<any> {
  return apiRequest(`/balances/${userId}/load`, {
    method: 'POST',
    body: JSON.stringify({ amount, paymentMethod: 'cash' }),
  });
}

export async function getBalanceHistory(userId: string): Promise<any[]> {
  return apiRequest(`/balances/${userId}/history`);
}

export async function getKitchenOrders(query?: string): Promise<any[]> {
  return apiRequest(`/kitchen/pedidos${query ? `?${query}` : ''}`);
}

export async function getPublicOrders(): Promise<any> {
  return apiRequest('/public/contagem');
}

export async function getReports(type: string, params?: any): Promise<any> {
  const query = params ? new URLSearchParams(params).toString() : '';
  return apiRequest(`/reports/${type}${query ? `?${query}` : ''}`);
}

export async function getProducts(): Promise<any[]> {
  return apiRequest('/products');
}

export async function createProduct(data: any): Promise<any> {
  return apiRequest('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(id: string, data: any): Promise<any> {
  return apiRequest(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getEvents(): Promise<any[]> {
  return apiRequest('/events');
}

export async function createEvent(data: any): Promise<any> {
  return apiRequest('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEvent(id: string, data: any): Promise<any> {
  return apiRequest(`/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
