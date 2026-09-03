export enum UserRole {
  SUPERADMIN = 'superadmin',
  ORGANIZER = 'organizer',
  CASHIER = 'cashier',
  BAR = 'bar',
  KITCHEN = 'kitchen',
  TREASURER = 'treasurer',
  CLIENT = 'client',
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

export enum EventStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CLOSED = 'closed',
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

export enum DeviceType {
  POS = 'pos',
  KDS = 'kds',
  PUBLIC = 'public',
  MOBILE = 'mobile',
}
