export enum UserRole {
  SUPERADMIN = 'superadmin',
  ORGANIZER = 'organizer',
  CASHIER = 'cashier',
  BAR = 'bar',
  KITCHEN = 'kitchen',
  TREASURER = 'treasurer',
  CLIENT = 'client',
}

export enum EventStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

export enum DeviceType {
  POS = 'pos',
  KDS = 'kds',
  PUBLIC = 'public',
  MOBILE = 'mobile',
}

export enum OrderStatus {
  RECEIVED = 'received',
  PREPARING = 'preparing',
  READY = 'ready',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum OrderSource {
  QR = 'qr',
  POS = 'pos',
}

export enum PaymentMethod {
  CASH = 'cash',
  MBWAY = 'mbway',
  BALANCE = 'balance',
}

export enum ProductAvailability {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  LIMITED = 'limited',
}

export enum MovementType {
  LOAD = 'load',
  CONSUME = 'consume',
  REFUND = 'refund',
  CANCEL = 'cancel',
}

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  organization?: string;
  status: EventStatus;
  settings: EventSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventSettings {
  currency: string;
  allowOffline: boolean;
  requireBalance: boolean;
  taxRate: number;
  serviceCharge: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  availability: ProductAvailability;
  stock?: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  eventId: string;
  source: OrderSource;
  status: OrderStatus;
  tableNumber?: string;
  station?: string;
  total: number;
  balanceUsed: number;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

export interface Balance {
  id: string;
  userId: string;
  currentBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BalanceMovement {
  id: string;
  balanceId: string;
  type: MovementType;
  amount: number;
  description?: string;
  orderId?: string;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: any;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface Station {
  id: string;
  eventId: string;
  name: string;
  type: string;
  isActive: boolean;
}

export interface DeviceSession {
  id: string;
  userId: string;
  deviceType: DeviceType;
  deviceName?: string;
  isActive: boolean;
  lastSeen: Date;
  createdAt: Date;
}