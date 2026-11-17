import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBalanceMovementReversedAmount1794870000000 implements MigrationInterface {
  name = 'AddBalanceMovementReversedAmount1794870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "balance_movements" ADD COLUMN "reversedAmount" numeric(10,2) NOT NULL DEFAULT 0',
    );
    // O código antigo marcava o movimento como reversed mesmo num estorno parcial.
    // Reconstrói o total real a partir dos movimentos que apontam para o original.
    await queryRunner.query(
      'UPDATE "balance_movements" AS original SET "reversedAmount" = LEAST(original."amount", COALESCE((SELECT SUM(reversal."amount") FROM "balance_movements" AS reversal WHERE reversal."reversedOfId" = original."id"), original."amount")) WHERE original."reversed" = true',
    );
    // Um estorno histórico parcial volta a ficar aberto para receber apenas o remanescente.
    await queryRunner.query(
      'UPDATE "balance_movements" SET "reversed" = ("reversedAmount" >= "amount"), "reversedAt" = CASE WHEN "reversedAmount" >= "amount" THEN "reversedAt" ELSE NULL END WHERE "reversed" = true',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "balance_movements" DROP COLUMN "reversedAmount"',
    );
  }
}
