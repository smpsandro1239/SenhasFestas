import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBalanceMovementReversedAmount1794870000000 implements MigrationInterface {
  name = 'AddBalanceMovementReversedAmount1794870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "balance_movements" ADD COLUMN "reversedAmount" numeric(10,2) NOT NULL DEFAULT 0',
    );
    // Preserva a semântica dos registos antigos já marcados como totalmente estornados.
    await queryRunner.query(
      'UPDATE "balance_movements" SET "reversedAmount" = "amount" WHERE "reversed" = true',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "balance_movements" DROP COLUMN "reversedAmount"',
    );
  }
}
