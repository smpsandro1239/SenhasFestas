import { MigrationInterface, QueryRunner } from 'typeorm';

export class BalanceArchiving1790100000000 implements MigrationInterface {
  name = 'BalanceArchiving1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "balanceGraceDays" integer NOT NULL DEFAULT 3`,
    );
    await queryRunner.query(`ALTER TABLE "balances" ADD COLUMN "archivedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "balances" ADD COLUMN "extendedUntil" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "balances" ADD COLUMN "notifiedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "balances" ADD COLUMN "deletedAt" TIMESTAMP`);
    await queryRunner.query(
      `CREATE INDEX "IDX_balances_archivedAt" ON "balances" ("archivedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_balances_archivedAt"`);
    await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "notifiedAt"`);
    await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "extendedUntil"`);
    await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "archivedAt"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "balanceGraceDays"`);
  }
}
