import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';

@Entity('users')
@Index(['email'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer', 'client'],
  })
  role: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('events')
@Index(['name'])
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: true })
  organization?: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'active', 'closed'],
    default: 'draft',
  })
  status: string;

  @Column({
    type: 'jsonb',
    default: () => `
      '{"currency": "EUR", "allowOffline": false, "requireBalance": true, 
        "taxRate": 0.06, "serviceCharge": 0}'
    `,
  })
  settings: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('event_users')
@Index(['event', 'user'])
export class EventUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EventEntity)
  event: EventEntity;

  @ManyToOne(() => UserEntity)
  user: UserEntity;

  @Column({
    type: 'enum',
    enum: ['superadmin', 'organizer', 'cashier', 'bar', 'kitchen', 'treasurer', 'client'],
  })
  role: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('categories')
@Index(['event'])
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EventEntity)
  event: EventEntity;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('products')
@Index(['category'])
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EventEntity)
  event: EventEntity;

  @ManyToOne(() => CategoryEntity)
  category: CategoryEntity;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: ['available', 'unavailable', 'limited'],
    default: 'available',
  })
  availability: string;

  @Column({ nullable: true })
  stock?: number;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  options?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  modifiers?: Record<string, any>;

  @Column({ nullable: true, type: 'text' })
  kitchenName?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('balances')
@Index(['user'])
export class BalanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity)
  user: UserEntity;

  @ManyToOne(() => EventEntity)
  event: EventEntity;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentBalance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum MovementType {
  LOAD = 'load',
  CONSUME = 'consume',
  REFUND = 'refund',
  CANCEL = 'cancel',
}

@Entity('balance_movements')
@Index(['balance', 'createdAt'])
export class BalanceMovementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => BalanceEntity)
  balance: BalanceEntity;

  @Column({
    type: 'enum',
    enum: ['load', 'consume', 'refund', 'cancel'],
  })
  type: MovementType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ type: 'uuid', nullable: true })
  orderId?: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('orders')
@Index(['event', 'createdAt'])
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EventEntity)
  event: EventEntity;

  @OneToMany(() => OrderItemEntity, (item) => item.order, { cascade: true })
  items: OrderItemEntity[];

  @Column({
    type: 'enum',
    enum: ['qr', 'pos'],
  })
  source: string;

  @Column({
    type: 'enum',
    enum: ['received', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'received',
  })
  status: string;

  @Column({ nullable: true })
  tableNumber?: string;

  @Column({ nullable: true })
  station?: string;

  @Column({ type: 'uuid', nullable: true })
  balanceId?: string;

  @Column({
    type: 'enum',
    enum: ['cash', 'mbway', 'balance'],
    default: 'balance',
  })
  paymentMethod: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balanceUsed: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  order: OrderEntity;

  @ManyToOne(() => ProductEntity)
  product: ProductEntity;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ nullable: true, type: 'text' })
  notes?: string;
}

@Entity('audit_logs')
@Index(['createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column({ type: 'uuid' })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>;

  @Column({ nullable: true })
  ip?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('stations')
@Index(['event'])
export class StationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EventEntity)
  event: EventEntity;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ default: true })
  isActive: boolean;
}

@Entity('device_sessions')
export class DeviceSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ['pos', 'kds', 'public', 'mobile'],
  })
  deviceType: string;

  @Column({ nullable: true })
  deviceName?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp' })
  lastSeen: Date;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('refresh_tokens')
@Index(['userId'])
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  replacedByTokenId?: string;

  @Column({ default: false })
  isUsed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('cash_closures')
@Index(['event', 'status'])
export class CashClosureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  eventId: string;

  @Column({ type: 'uuid' })
  openedById: string;

  @Column({ type: 'timestamp' })
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  openingBalance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  closingBalance?: number;

  @Column({
    type: 'enum',
    enum: ['open', 'closed'],
    default: 'open',
  })
  status: string;

  @Column({ nullable: true, type: 'text' })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
