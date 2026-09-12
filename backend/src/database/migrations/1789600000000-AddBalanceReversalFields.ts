import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBalanceReversalFields1789600000000 implements MigrationInterface {
  name = 'AddBalanceReversalFields1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "balance_movements" ADD COLUMN "reversed" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "balance_movements" ADD COLUMN "reversedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "balance_movements" ADD COLUMN "reversedOfId" uuid`);
    await queryRunner.query(`ALTER TABLE "balance_movements" ADD COLUMN "createdById" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_balance_movements_reversedOf" ON "balance_movements" ("reversedOfId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_balance_movements_reversedOf"`);
    await queryRunner.query(`ALTER TABLE "balance_movements" DROP COLUMN "createdById"`);
    await queryRunner.query(`ALTER TABLE "balance_movements" DROP COLUMN "reversedOfId"`);
    await queryRunner.query(`ALTER TABLE "balance_movements" DROP COLUMN "reversedAt"`);
    await queryRunner.query(`ALTER TABLE "balance_movements" DROP COLUMN "reversed"`);
  }
}
