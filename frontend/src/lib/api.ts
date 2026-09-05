const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '';
const API_URL = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '');
const API_BASE = API_URL ? `${API_URL}/api` : '/api';

const TIMEOUT_MS = 10000;

const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refreshToken';
const USER_KEY = 'user';
const TOKEN_COOKIE = 'sf_token';
const ROLE_COOKIE = 'sf_role';
const USER_COOKIE = 'sf_user';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getStorage(): Storage | null {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function setCookie(name: string, value: string, days = 30): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function persistSession(token: string, refreshToken: string, user: unknown): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(REFRESH_KEY, refreshToken);
  storage.setItem(USER_KEY, JSON.stringify(user));
  const role = typeof user === 'object' && user !== null && 'role' in user ? String((user as { role: unknown }).role) : '';
  setCookie(TOKEN_COOKIE, token);
  setCookie(ROLE_COOKIE, role);
  setCookie(USER_COOKIE, JSON.stringify(user), 7);
}

export function destroySession(redirect = true): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(REFRESH_KEY);
    storage.removeItem(USER_KEY);
  }
  clearCookie(TOKEN_COOKIE);
  clearCookie(ROLE_COOKIE);
  clearCookie(USER_COOKIE);
  if (redirect && typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/login')) {
    window.location.assign('/auth/login');
  }
}

async function readErrorBody(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: string };
    return body?.message ?? null;
  } catch {
    return null;
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const storage = getStorage();
  const refreshToken = storage?.getItem(REFRESH_KEY);
  if (!refreshToken) return false;

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) return false;

        const data = (await response.json()) as {
          token: string;
          refreshToken: string;
          user: unknown;
        };
        persistSession(data.token, data.refreshToken, data.user);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retryOn401 = true,
): Promise<T> {
  const storage = typeof window !== 'undefined' ? window.localStorage : null;
  const token = storage?.getItem(TOKEN_KEY) ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string>),
      },
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('Não foi possível contactar o servidor. Tente novamente.', 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 && retryOn401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(endpoint, options, false);
    }
    destroySession();
    throw new ApiError('Sessão expirada. Inicie sessão novamente.', 401);
  }

  if (!response.ok) {
    const message = (await readErrorBody(response)) || `Erro na requisição (${response.status})`;
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return request<T>(endpoint, options);
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return request<T>(endpoint, options);
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

export async function logout(refreshToken?: string): Promise<void> {
  if (refreshToken) {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // sessão local é sempre limpa no fim
    }
  }
  destroySession(false);
}

export async function getOrders(): Promise<any> {
  return apiRequest('/orders');
}

export async function getOrdersByEvent(eventId: string): Promise<any> {
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

export async function getBalanceHistory(userId: string): Promise<any> {
  return apiRequest(`/balances/${userId}/history`);
}

export async function getKitchenOrders(query?: string): Promise<any> {
  return apiRequest(`/kitchen/pedidos${query ? `?${query}` : ''}`);
}

export async function getPublicOrders(): Promise<any> {
  return apiRequest('/public/contagem');
}

export async function getReports(type: string, params?: any): Promise<any> {
  const query = params ? new URLSearchParams(params).toString() : '';
  return apiRequest(`/reports/${type}${query ? `?${query}` : ''}`);
}

export async function getProducts(): Promise<any> {
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

export async function getEvents(): Promise<any> {
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

export async function getUsers(): Promise<any> {
  return apiRequest('/users');
}

export async function createUser(data: any): Promise<any> {
  return apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMe(): Promise<any> {
  return apiRequest('/users/me');
}

export async function getOpenCash(eventId: string): Promise<any> {
  return apiRequest(`/cash-closure/event/${eventId}/aberta`);
}

export async function openCash(data: any): Promise<any> {
  return apiRequest('/cash-closure/abrir', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function closeCash(id: string, data: any): Promise<any> {
  return apiRequest(`/cash-closure/${id}/fechar`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCashByEvent(eventId: string): Promise<any[]> {
  return apiRequest(`/cash-closure/event/${eventId}`);
}