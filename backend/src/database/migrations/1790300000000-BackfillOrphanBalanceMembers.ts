import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill de vínculos em falta: cliente com saldo (currentBalance > 0) num
 * evento do qual não é membro. Cria EventUser (role client) para tornar o
 * saldo acessível — o fix em loadBalance/deductBalance previne novos órfãos,
 * esta migration corrige os existentes (ex: 100€ presos sem membership).
 */
export class BackfillOrphanBalanceMembers1790300000000 implements MigrationInterface {
  name = 'BackfillOrphanBalanceMembers1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "event_users" ("id", "eventId", "userId", "role", "createdAt")
      SELECT gen_random_uuid(), b."eventId", b."userId", 'client', now()
      FROM "balances" b
      WHERE b."eventId" IS NOT NULL
        AND b."currentBalance" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "event_users" eu
          WHERE eu."eventId" = b."eventId" AND eu."userId" = b."userId"
        )
    `);
  }

  public async down(): Promise<void> {
    // no-op: reverter criaria órfãos novamente
  }
}