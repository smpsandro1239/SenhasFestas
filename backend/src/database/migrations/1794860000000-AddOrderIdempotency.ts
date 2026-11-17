import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderIdempotency1794860000000 implements MigrationInterface {
  name = 'AddOrderIdempotency1794860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "orders" ADD "createdById" uuid',
    );
    await queryRunner.query(
      'ALTER TABLE "orders" ADD "idempotencyKey" character varying(128)',
    );
    await queryRunner.query(
      'ALTER TABLE "orders" ADD "requestHash" character(64)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_orders_idempotency" ON "orders" ("eventId", "createdById", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "createdById" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_orders_idempotency_created" ON "orders" ("createdAt") WHERE "idempotencyKey" IS NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_created_by"');
    await queryRunner.query('DROP INDEX "IDX_orders_idempotency_created"');
    await queryRunner.query('DROP INDEX "UQ_orders_idempotency"');
    await queryRunner.query('ALTER TABLE "orders" DROP COLUMN "requestHash"');
    await queryRunner.query('ALTER TABLE "orders" DROP COLUMN "idempotencyKey"');
    await queryRunner.query('ALTER TABLE "orders" DROP COLUMN "createdById"');
  }
}
