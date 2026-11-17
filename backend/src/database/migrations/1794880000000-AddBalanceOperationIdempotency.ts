import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBalanceOperationIdempotency1794880000000 implements MigrationInterface {
  name = 'AddBalanceOperationIdempotency1794880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "balance_movements" ADD COLUMN "idempotencyKey" varchar(128) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "balance_movements" ADD COLUMN "requestHash" char(64) NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_balance_movements_idempotency" ON "balance_movements" ("createdById", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "createdById" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_balance_movements_idempotency"');
    await queryRunner.query('ALTER TABLE "balance_movements" DROP COLUMN "requestHash"');
    await queryRunner.query('ALTER TABLE "balance_movements" DROP COLUMN "idempotencyKey"');
  }
}
