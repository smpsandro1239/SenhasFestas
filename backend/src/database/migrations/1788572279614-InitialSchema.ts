import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1788572279614 implements MigrationInterface {
  name = 'InitialSchema1788572279614';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "users_role_enum" AS ENUM ('superadmin','organizer','cashier','bar','kitchen','treasurer','client')`,
    );
    await queryRunner.query(
      `CREATE TYPE "events_status_enum" AS ENUM ('draft','active','closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "products_availability_enum" AS ENUM ('available','unavailable','limited')`,
    );
    await queryRunner.query(
      `CREATE TYPE "balance_movements_type_enum" AS ENUM ('load','consume','refund','cancel')`,
    );
    await queryRunner.query(
      `CREATE TYPE "orders_source_enum" AS ENUM ('qr','pos')`,
    );
    await queryRunner.query(
      `CREATE TYPE "orders_status_enum" AS ENUM ('received','preparing','ready','delivered','cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "orders_payment_method_enum" AS ENUM ('cash','mbway','balance')`,
    );
    await queryRunner.query(
      `CREATE TYPE "device_sessions_device_type_enum" AS ENUM ('pos','kds','public','mobile')`,
    );
    await queryRunner.query(
      `CREATE TYPE "cash_closures_status_enum" AS ENUM ('open','closed')`,
    );

    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying NOT NULL, "role" "users_role_enum" NOT NULL, "phone" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_users" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IU_users_email" ON "users" ("email")`,
    );

    await queryRunner.query(
      `CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "description" text, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP NOT NULL, "location" character varying, "organization" character varying, "status" "events_status_enum" NOT NULL DEFAULT 'draft', "settings" jsonb NOT NULL DEFAULT '{"currency":"EUR","allowOffline":false,"requireBalance":true,"taxRate":0.06,"serviceCharge":0}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_events_name" ON "events" ("name")`,
    );

    await queryRunner.query(
      `CREATE TABLE "event_users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "role" "users_role_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "eventId" uuid, "userId" uuid, CONSTRAINT "PK_event_users" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_users_event_user" ON "event_users" ("eventId", "userId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "description" character varying, "sortOrder" integer NOT NULL DEFAULT 0, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "eventId" uuid, CONSTRAINT "PK_categories" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_event" ON "categories" ("eventId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "description" text, "price" numeric(10,2) NOT NULL, "availability" "products_availability_enum" NOT NULL DEFAULT 'available', "stock" integer, "imageUrl" character varying, "isActive" boolean NOT NULL DEFAULT true, "options" jsonb, "modifiers" jsonb, "kitchenName" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "eventId" uuid, "categoryId" uuid, CONSTRAINT "PK_products" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_category" ON "products" ("categoryId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "balances" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "currentBalance" numeric(10,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "eventId" uuid, CONSTRAINT "PK_balances" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_balances_user" ON "balances" ("userId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "balance_movements" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "type" "balance_movements_type_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "description" text, "orderId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "balanceId" uuid, CONSTRAINT "PK_balance_movements" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_balance_movements_balance_created" ON "balance_movements" ("balanceId", "createdAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "source" "orders_source_enum" NOT NULL, "status" "orders_status_enum" NOT NULL DEFAULT 'received', "tableNumber" character varying, "station" character varying, "balanceId" uuid, "paymentMethod" "orders_payment_method_enum" NOT NULL DEFAULT 'balance', "total" numeric(10,2) NOT NULL, "balanceUsed" numeric(10,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "eventId" uuid, CONSTRAINT "PK_orders" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_event_created" ON "orders" ("eventId", "createdAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "quantity" integer NOT NULL, "unitPrice" numeric(10,2) NOT NULL, "subtotal" numeric(10,2) NOT NULL, "notes" text, "orderId" uuid, "productId" uuid, CONSTRAINT "PK_order_items" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "action" character varying NOT NULL, "resource" character varying NOT NULL, "resourceId" uuid NOT NULL, "details" jsonb, "ip" character varying, "userAgent" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_created" ON "audit_logs" ("createdAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE "stations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "type" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "eventId" uuid, CONSTRAINT "PK_stations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stations_event" ON "stations" ("eventId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "device_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "deviceType" "device_sessions_device_type_enum" NOT NULL, "deviceName" character varying, "isActive" boolean NOT NULL DEFAULT true, "lastSeen" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_device_sessions" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "cash_closures" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "eventId" uuid NOT NULL, "openedById" uuid NOT NULL, "openedAt" TIMESTAMP NOT NULL, "closedAt" TIMESTAMP, "openingBalance" numeric(10,2) NOT NULL DEFAULT '0', "closingBalance" numeric(10,2), "status" "cash_closures_status_enum" NOT NULL DEFAULT 'open', "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cash_closures" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cash_closures_event_status" ON "cash_closures" ("eventId", "status")`,
    );

    await queryRunner.query(
      `ALTER TABLE "event_users" ADD CONSTRAINT "FK_event_users_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_users" ADD CONSTRAINT "FK_event_users_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_products_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_products_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "balances" ADD CONSTRAINT "FK_balances_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "balances" ADD CONSTRAINT "FK_balances_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "balance_movements" ADD CONSTRAINT "FK_balance_movements_balance" FOREIGN KEY ("balanceId") REFERENCES "balances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stations" ADD CONSTRAINT "FK_stations_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stations" DROP CONSTRAINT "FK_stations_event"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_product"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_order"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_event"`);
    await queryRunner.query(`ALTER TABLE "balance_movements" DROP CONSTRAINT "FK_balance_movements_balance"`);
    await queryRunner.query(`ALTER TABLE "balances" DROP CONSTRAINT "FK_balances_event"`);
    await queryRunner.query(`ALTER TABLE "balances" DROP CONSTRAINT "FK_balances_user"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_products_category"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_products_event"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_event"`);
    await queryRunner.query(`ALTER TABLE "event_users" DROP CONSTRAINT "FK_event_users_user"`);
    await queryRunner.query(`ALTER TABLE "event_users" DROP CONSTRAINT "FK_event_users_event"`);

    await queryRunner.query(`DROP INDEX "IDX_cash_closures_event_status"`);
    await queryRunner.query(`DROP TABLE "cash_closures"`);
    await queryRunner.query(`DROP TABLE "device_sessions"`);
    await queryRunner.query(`DROP INDEX "IDX_stations_event"`);
    await queryRunner.query(`DROP TABLE "stations"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_created"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP INDEX "IDX_orders_event_created"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP INDEX "IDX_balance_movements_balance_created"`);
    await queryRunner.query(`DROP TABLE "balance_movements"`);
    await queryRunner.query(`DROP INDEX "IDX_balances_user"`);
    await queryRunner.query(`DROP TABLE "balances"`);
    await queryRunner.query(`DROP INDEX "IDX_products_category"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP INDEX "IDX_categories_event"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP INDEX "IDX_event_users_event_user"`);
    await queryRunner.query(`DROP TABLE "event_users"`);
    await queryRunner.query(`DROP INDEX "IDX_events_name"`);
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP INDEX "IU_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(`DROP TYPE "cash_closures_status_enum"`);
    await queryRunner.query(`DROP TYPE "device_sessions_device_type_enum"`);
    await queryRunner.query(`DROP TYPE "orders_payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "orders_status_enum"`);
    await queryRunner.query(`DROP TYPE "orders_source_enum"`);
    await queryRunner.query(`DROP TYPE "balance_movements_type_enum"`);
    await queryRunner.query(`DROP TYPE "products_availability_enum"`);
    await queryRunner.query(`DROP TYPE "events_status_enum"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}