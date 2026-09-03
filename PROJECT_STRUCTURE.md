# Bacana Project Structure

## Backend (NestJS)
```
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── entities/
│   │   └── index.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── jwt.strategy.ts
│   │   ├── event/
│   │   ├── catalog/
│   │   ├── balance/
│   │   ├── order/
│   │   ├── kitchen/
│   │   ├── public-screen/
│   │   ├── reports/
│   │   ├── cash-closure/
│   │   └── user/
│   ├── common/
│   ├── guards/
│   ├── decorators/
│   ├── dto/
│   ├── interfaces/
│   ├── schemas/
│   ├── services/
│   └── utils/
├── test/
├── .env.example
└── tsconfig.json
```

## Frontend (Next.js + Tailwind CSS)
```
frontend/
├── app/
│   ├── auth/
│   │   ├── login/
│   │   └── register/
│   ├── pos/
│   │   ├── page.tsx
│   │   └── components/
│   ├── kds/
│   │   ├── page.tsx
│   │   └── components/
│   ├── public/
│   │   ├── page.tsx
│   │   └── components/
│   ├── admin/
│   │   ├── events/
│   │   ├── products/
│   │   └── reports/
│   └── layout.tsx
├── components/
│   ├── ui/
│   └── shared/
├── hooks/
├── lib/
│   ├── api/
│   ├── auth/
│   └── utils/
├── types/
└── tailwind.config.ts
```

## Database Schema
The database uses PostgreSQL with the following main tables:
1. `users` - All users of the system
2. `events` - Festival events
3. `event_users` - Many-to-many relation for event-specific roles
4. `categories` - Menu categories
5. `products` - Menu products
6. `balances` - User balances per event
7. `balance_movements` - History of balance changes
8. `orders` - Orders (both QR and POS)
9. `order_items` - Items in orders
10. `stations` - Bar/cashier stations
11. `audit_logs` - Audit trail
12. `device_sessions` - Device tracking

## Sprints

### Sprint 1: Foundation
- Auth module: JWT login/register, role-based access
- User entity and CRUD
- Event module: CRUD with settings
- Catalog: Categories and products

### Sprint 2: Balance and QR Orders
- Balance module: Top up, check balance
- QR code generation (uuid-based)
- Order creation via QR (client selects items)
- Balance validation

### Sprint 3: POS, KDS, Public Screen
- POS module: Create orders manually
- KDS: Real-time order list with WebSocket
- Public screen: Live order status display

### Sprint 4: Reports and Cash Closure
- Reports module: Sales, products, time stats
- Cash closure: Reconciliation
- Admin panel

## API Endpoints

### Public
- `POST /auth/login` - Login
- `POST /auth/register` - Register (superadmin only)

### Auth Routes (with JWT)
- `GET /users/me` - Current user
- `GET /users` - List users (admin only)

### Event Routes
- `GET /events` - List events
- `POST /events` - Create event
- `GET /events/:id` - Get event
- `PATCH /events/:id` - Update event
- `DELETE /events/:id` - Delete event

### Catalog Routes
- `GET /products` - List products
- `POST /products` - Create product
- `GET /products/:id` - Get product
- `PATCH /products/:id` - Update product

### Balance Routes
- `GET /balances/:userId` - Get balance
- `POST /balances/loads` - Load balance
- `GET /balances/:userId/movements` - History

### Order Routes
- `POST /orders` - Create order
- `GET /orders` - List orders
- `GET /orders/:id` - Get order
- `PATCH /orders/:id/status` - Update status
- `GET /qr/:id` - Load order by QR code

### Kitchen Routes
- `GET /kitchen/orders?status=received` - Pending orders
- `PATCH /kitchen/orders/:id/status` - Update status

### Public Screen Routes
- `GET /public/orders?status=ready` - Ready orders
- `GET /public/orders?status=preparing` - Preparing orders

### Reports Routes
- `GET /reports/sales` - Sales report
- `GET /reports/products` - Product report
- `GET /reports/caixa` - Cash report

### Cash Closure Routes
- `POST /cash-closure` - Create closure
- `GET /cash-closure` - List closures
- `GET /cash-closure/:id` - Get closure